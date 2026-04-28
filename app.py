import io
import json
import os
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd

import uvicorn
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="Connected Kerb API")

if os.getenv("ENV") != "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

AZURE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER", "plans")
AI_FOUNDRY_ENDPOINT = os.getenv("AI_FOUNDRY_ENDPOINT", "")
AI_FOUNDRY_API_KEY = os.getenv("AI_FOUNDRY_API_KEY", "")
AI_FOUNDRY_DEPLOYMENT = os.getenv("AI_FOUNDRY_DEPLOYMENT", "")
AI_FOUNDRY_API_VERSION = os.getenv("AI_FOUNDRY_API_VERSION", "2024-05-01-preview")
AI_FOUNDRY_AGENT_NAME = os.getenv("AI_FOUNDRY_AGENT_NAME", "")
AI_FOUNDRY_AGENT_VERSION = os.getenv("AI_FOUNDRY_AGENT_VERSION", "")

_ASSUMPTIONS_PATH = Path(
    os.getenv("ASSUMPTIONS_PATH", Path(__file__).parent / "data" / "assumptions.json")
)
if not _ASSUMPTIONS_PATH.is_absolute():
    _ASSUMPTIONS_PATH = Path(__file__).parent / _ASSUMPTIONS_PATH

with open(_ASSUMPTIONS_PATH) as _f:
    ASSUMPTIONS: dict = json.load(_f)


class ChatMessage(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)


class RowUpdateBody(BaseModel):
    region_name: Optional[str] = None
    contract_name: Optional[str] = None
    work_package_name: Optional[str] = None
    capex_bom_per_socket: Optional[float] = None
    capex_installation_per_socket: Optional[float] = None
    capex_connection_per_socket: Optional[float] = None
    total_capex_per_socket: Optional[float] = None
    target_sockets: Optional[int] = None
    target_sockets_1: Optional[int] = None
    target_sockets_2: Optional[int] = None
    target_sockets_3: Optional[int] = None
    target_sockets_4: Optional[int] = None
    target_sockets_5: Optional[int] = None
    target_sockets_6: Optional[int] = None
    target_sockets_7: Optional[int] = None
    target_sockets_8: Optional[int] = None
    target_sockets_9: Optional[int] = None
    target_sockets_10: Optional[int] = None
    target_sockets_11: Optional[int] = None
    target_sockets_12: Optional[int] = None


# ─── Blob storage helpers (Excel files only) ──────────────────────────────────

def get_container_client():
    if not AZURE_CONNECTION_STRING:
        raise HTTPException(
            status_code=500,
            detail="AZURE_STORAGE_CONNECTION_STRING is not configured",
        )
    service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
    container = service.get_container_client(CONTAINER_NAME)
    try:
        container.create_container()
    except Exception:
        pass
    return container


def upload_excel(container, plan_id: str, filename: str, content: bytes) -> str:
    blob_path = f"{plan_id}/{filename}"
    container.get_blob_client(blob_path).upload_blob(content, overwrite=True)
    return blob_path


def delete_plan_blobs(container, plan_id: str) -> None:
    for blob in list(container.list_blobs(name_starts_with=f"{plan_id}/")):
        container.delete_blob(blob.name)


def get_excel_blob(container, plan_id: str):
    blobs = [b for b in container.list_blobs(name_starts_with=f"{plan_id}/")]
    return blobs[0] if blobs else None


# ─── Metrics calculation (from SQL rows + assumptions.json) ───────────────────

def compute_metrics_from_rows(rows: list[dict]) -> dict:
    target_sockets = sum(r["target_sockets"] for r in rows)
    bom_capex = sum(r["target_sockets"] * float(r["capex_bom_per_socket"]) for r in rows)
    installation_capex = sum(r["target_sockets"] * float(r["capex_installation_per_socket"]) for r in rows)
    connection_capex = sum(r["target_sockets"] * float(r["capex_connection_per_socket"]) for r in rows)
    total_capex = sum(r["target_sockets"] * float(r["total_capex_per_socket"]) for r in rows)

    sr_capacity = ASSUMPTIONS["delivery_capacity_sockets_per_year"]["senior_delivery_manager"]
    dm_capacity = ASSUMPTIONS["delivery_capacity_sockets_per_year"]["delivery_manager"]
    asset_value_per_socket = ASSUMPTIONS["value_per_socket"]["asset_value_per_socket"]


    return {
        "target_sockets": target_sockets,
        "capex": {
            "total": total_capex,
            "bom": bom_capex,
            "installation": installation_capex,
            "connection": connection_capex,
        },
        "workforce": {
            "senior_delivery_managers_required": round(target_sockets / sr_capacity, 1) if sr_capacity else 0.0,
            "delivery_managers_required": round(target_sockets / dm_capacity, 1) if dm_capacity else 0.0,
        },
        "asset_value": float(target_sockets * asset_value_per_socket),
    }


# ─── AI Foundry helpers ───────────────────────────────────────────────────────

def build_foundry_chat_url() -> str:
    endpoint = AI_FOUNDRY_ENDPOINT.rstrip("/")
    if not endpoint:
        raise HTTPException(status_code=500, detail="AI_FOUNDRY_ENDPOINT is not configured")

    if "/openai/v1" in endpoint:
        if endpoint.endswith("/chat/completions"):
            return endpoint
        return f"{endpoint}/chat/completions"

    if "/chat/completions" in endpoint:
        if "api-version=" in endpoint:
            return endpoint
        separator = "&" if "?" in endpoint else "?"
        return f"{endpoint}{separator}api-version={AI_FOUNDRY_API_VERSION}"

    if AI_FOUNDRY_DEPLOYMENT:
        return (
            f"{endpoint}/openai/deployments/{AI_FOUNDRY_DEPLOYMENT}"
            f"/chat/completions?api-version={AI_FOUNDRY_API_VERSION}"
        )

    return f"{endpoint}/chat/completions?api-version={AI_FOUNDRY_API_VERSION}"


def ask_foundry(messages: list[ChatMessage]) -> str:
    if "/api/projects/" in AI_FOUNDRY_ENDPOINT:
        return ask_foundry_agent(messages)

    if not AI_FOUNDRY_API_KEY:
        raise HTTPException(status_code=500, detail="AI_FOUNDRY_API_KEY is not configured")

    payload = {
        "messages": [message.dict() for message in messages],
        "temperature": 0.4,
        "max_tokens": 800,
    }
    if "/openai/v1" in AI_FOUNDRY_ENDPOINT and AI_FOUNDRY_DEPLOYMENT:
        payload["model"] = AI_FOUNDRY_DEPLOYMENT

    request = urllib.request.Request(
        build_foundry_chat_url(),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "api-key": AI_FOUNDRY_API_KEY},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=exc.code, detail=body or "AI Foundry request failed") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach AI Foundry endpoint: {exc.reason}") from exc

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="AI Foundry returned an unexpected response shape") from exc


def ask_foundry_agent(messages: list[ChatMessage]) -> str:
    if not AI_FOUNDRY_AGENT_NAME or not AI_FOUNDRY_AGENT_VERSION:
        raise HTTPException(
            status_code=500,
            detail="AI_FOUNDRY_AGENT_NAME and AI_FOUNDRY_AGENT_VERSION are required for project agent endpoints",
        )
    try:
        from azure.ai.projects import AIProjectClient
        from azure.identity import DefaultAzureCredential
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="Install azure-ai-projects and azure-identity") from exc

    try:
        project_client = AIProjectClient(endpoint=AI_FOUNDRY_ENDPOINT, credential=DefaultAzureCredential())
        openai_client = project_client.get_openai_client()
        response = openai_client.responses.create(
            input=[message.dict() for message in messages if message.role != "system"],
            extra_body={
                "agent_reference": {
                    "name": AI_FOUNDRY_AGENT_NAME,
                    "version": AI_FOUNDRY_AGENT_VERSION,
                    "type": "agent_reference",
                }
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI Foundry agent request failed: {exc}") from exc

    output_text = getattr(response, "output_text", None)
    if not output_text:
        raise HTTPException(status_code=502, detail="AI Foundry agent returned an empty response")
    return output_text


# ─── API routes ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/assumptions")
def get_assumptions():
    return ASSUMPTIONS


@app.post("/api/ai-assistant/chat")
def chat_with_assistant(request: ChatRequest):
    for message in request.messages:
        if message.role not in {"user", "assistant"}:
            raise HTTPException(status_code=400, detail="Invalid chat message role")
    system_prompt = ChatMessage(
        role="system",
        content=(
            "You are the Connected Kerb planning assistant. Help users analyse "
            "EV charging infrastructure plans, delivery risks, schedules, costs, "
            "assumptions, and portfolio trade-offs. Be concise, practical, and "
            "ask for missing plan context when needed."
        ),
    )
    return {"message": ask_foundry([system_prompt, *request.messages])}


# ─── Plans CRUD (metadata in SQL, Excel in blob) ──────────────────────────────

@app.get("/api/plans")
def list_plans():
    import db as _db
    return _db.list_plans()


@app.post("/api/plans", status_code=201)
async def create_plan(name: str = Form(...), file: UploadFile = File(...)):
    import db as _db
    container = get_container_client()
    plan_id = str(uuid.uuid4())
    content = await file.read()
    created_at = datetime.now(timezone.utc).isoformat()

    blob_path = upload_excel(container, plan_id, file.filename, content)

    plan = _db.create_plan(
        plan_id=plan_id,
        plan_name=name,
        blob_path=blob_path,
        file_name=file.filename or "",
        file_size=len(content),
        file_type=file.content_type or "",
        created_at=created_at,
    )

    df = pd.read_excel(io.BytesIO(content), sheet_name="Sheet1")
    _db.sync_rows(plan_id, df)

    return plan


@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: str):
    import db as _db
    plan = _db.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@app.patch("/api/plans/{plan_id}")
async def update_plan(
    plan_id: str,
    name: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    import db as _db
    plan = _db.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    updates: dict = {}
    if name is not None:
        updates["plan_name"] = name
    if status is not None:
        updates["status"] = status

    if file is not None:
        content = await file.read()
        container = get_container_client()
        delete_plan_blobs(container, plan_id)
        blob_path = upload_excel(container, plan_id, file.filename, content)
        updates["blob_path"] = blob_path
        updates["file_name"] = file.filename or ""
        updates["file_size"] = len(content)
        updates["file_type"] = file.content_type or ""

        df = pd.read_excel(io.BytesIO(content), sheet_name="Sheet1")
        _db.sync_rows(plan_id, df)

    return _db.update_plan(plan_id, **updates)


@app.delete("/api/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: str):
    import db as _db
    container = get_container_client()
    delete_plan_blobs(container, plan_id)
    _db.delete_plan(plan_id)


# ─── Plan data endpoints ──────────────────────────────────────────────────────

@app.get("/api/plans/{plan_id}/metrics")
def get_plan_metrics(plan_id: str):
    import db as _db
    rows = _db.get_rows(plan_id)
    return compute_metrics_from_rows(rows)


@app.get("/api/plans/{plan_id}/rows")
def get_plan_rows(plan_id: str):
    import db as _db
    return _db.get_rows(plan_id)


@app.put("/api/plans/{plan_id}/rows/{row_id}", status_code=200)
def update_plan_row(plan_id: str, row_id: int, body: RowUpdateBody):
    import db as _db
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    _db.update_row(row_id, data)
    return {"ok": True}


@app.get("/api/plans/{plan_id}/file")
def get_plan_file(plan_id: str):
    import db as _db
    plan = _db.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    container = get_container_client()
    blob = get_excel_blob(container, plan_id)
    if not blob:
        raise HTTPException(status_code=404, detail="File not found")

    client = container.get_blob_client(blob.name)
    filename = blob.name.split("/")[-1]

    def stream():
        yield from client.download_blob().chunks()

    return StreamingResponse(
        stream(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Serve built React app in production ─────────────────────────────────────

if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
