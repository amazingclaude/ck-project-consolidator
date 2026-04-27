import io
import json
import os
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

load_dotenv()

app = FastAPI(title="Connected Kerb API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AZURE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER", "plans")

_ASSUMPTIONS_PATH = Path(__file__).parent / "data" / "assumptions.json"
with open(_ASSUMPTIONS_PATH) as _f:
    ASSUMPTIONS: dict = json.load(_f)


# ─── Storage helpers ──────────────────────────────────────────────────────────

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
        pass  # container already exists
    return container


def read_metadata(container, plan_id: str) -> dict:
    try:
        blob = container.get_blob_client(f"{plan_id}/metadata.json")
        return json.loads(blob.download_blob().readall())
    except Exception:
        raise HTTPException(status_code=404, detail="Plan not found")


def write_metadata(container, metadata: dict) -> None:
    plan_id = metadata["id"]
    blob = container.get_blob_client(f"{plan_id}/metadata.json")
    blob.upload_blob(json.dumps(metadata), overwrite=True)


def compute_metrics(content: bytes) -> dict:
    df = pd.read_excel(io.BytesIO(content), sheet_name="Sheet1")

    def col_sum(col: str) -> float:
        return float(df[col].fillna(0).sum()) if col in df.columns else 0.0

    planned_sockets = int(col_sum("planned_sockets"))
    target_sockets = int(col_sum("target_sockets"))

    sr_capacity = ASSUMPTIONS["delivery_capacity_sockets_per_year"]["senior_delivery_manager"]
    dm_capacity = ASSUMPTIONS["delivery_capacity_sockets_per_year"]["delivery_manager"]
    asset_per_socket = ASSUMPTIONS["value_per_socket"]["asset_value"]

    return {
        "targets_vs_planned": {
            "target_sockets": target_sockets,
            "planned_sockets": planned_sockets,
        },
        "capex": {
            "total": col_sum("total_capex"),
            "bom": col_sum("capex_bom"),
            "installation": col_sum("capex_installation"),
            "connection": col_sum("capex_connection"),
        },
        "workforce": {
            "senior_delivery_managers_required": round(planned_sockets / sr_capacity, 1) if sr_capacity else 0.0,
            "delivery_managers_required": round(planned_sockets / dm_capacity, 1) if dm_capacity else 0.0,
        },
        "asset_value": float(target_sockets * asset_per_socket),
    }


def write_metrics_cache(container, plan_id: str, metrics: dict) -> None:
    blob = container.get_blob_client(f"{plan_id}/metrics.json")
    blob.upload_blob(json.dumps(metrics), overwrite=True)


# ─── API routes ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/assumptions")
def get_assumptions():
    return ASSUMPTIONS


@app.get("/api/plans")
def list_plans():
    container = get_container_client()
    plans = []
    seen: set[str] = set()

    for blob in container.list_blobs():
        if not blob.name.endswith("/metadata.json"):
            continue
        plan_id = blob.name.split("/")[0]
        if plan_id in seen:
            continue
        seen.add(plan_id)
        try:
            client = container.get_blob_client(blob.name)
            plans.append(json.loads(client.download_blob().readall()))
        except Exception:
            continue

    plans.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    return plans


@app.post("/api/plans", status_code=201)
async def create_plan(name: str = Form(...), file: UploadFile = File(...)):
    container = get_container_client()
    plan_id = str(uuid.uuid4())
    content = await file.read()

    container.get_blob_client(f"{plan_id}/{file.filename}").upload_blob(
        content, overwrite=True
    )

    metadata = {
        "id": plan_id,
        "name": name,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "fileName": file.filename,
        "fileSize": len(content),
        "fileType": file.content_type or "",
    }
    write_metadata(container, metadata)
    write_metrics_cache(container, plan_id, compute_metrics(content))
    return metadata


@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: str):
    return read_metadata(get_container_client(), plan_id)


@app.patch("/api/plans/{plan_id}")
async def update_plan(
    plan_id: str,
    name: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    container = get_container_client()
    metadata = read_metadata(container, plan_id)

    if name is not None:
        metadata["name"] = name
    if status is not None:
        metadata["status"] = status

    if file is not None:
        content = await file.read()
        # Remove old Excel file only (keep metadata.json and metrics.json)
        for blob in container.list_blobs(name_starts_with=f"{plan_id}/"):
            if not blob.name.endswith("metadata.json") and not blob.name.endswith("metrics.json"):
                container.delete_blob(blob.name)
        container.get_blob_client(f"{plan_id}/{file.filename}").upload_blob(
            content, overwrite=True
        )
        metadata["fileName"] = file.filename
        metadata["fileSize"] = len(content)
        metadata["fileType"] = file.content_type or ""
        write_metrics_cache(container, plan_id, compute_metrics(content))

    write_metadata(container, metadata)
    return metadata


@app.delete("/api/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: str):
    container = get_container_client()
    for blob in list(container.list_blobs(name_starts_with=f"{plan_id}/")):
        container.delete_blob(blob.name)


@app.get("/api/plans/{plan_id}/metrics")
def get_plan_metrics(plan_id: str):
    container = get_container_client()

    # Cache-first: return pre-computed metrics.json if it has all expected fields
    try:
        cached = json.loads(
            container.get_blob_client(f"{plan_id}/metrics.json").download_blob().readall()
        )
        if "workforce" in cached and "asset_value" in cached:
            return cached
    except Exception:
        pass  # cache miss or stale schema — fall through to recompute

    file_blob = next(
        (
            b
            for b in container.list_blobs(name_starts_with=f"{plan_id}/")
            if not b.name.endswith("metadata.json") and not b.name.endswith("metrics.json")
        ),
        None,
    )
    if not file_blob:
        raise HTTPException(status_code=404, detail="Plan file not found")

    content = container.get_blob_client(file_blob.name).download_blob().readall()
    metrics = compute_metrics(content)
    write_metrics_cache(container, plan_id, metrics)
    return metrics


@app.get("/api/plans/{plan_id}/data")
def get_plan_data(plan_id: str):
    container = get_container_client()
    file_blob = next(
        (
            b
            for b in container.list_blobs(name_starts_with=f"{plan_id}/")
            if not b.name.endswith("metadata.json") and not b.name.endswith("metrics.json")
        ),
        None,
    )
    if not file_blob:
        raise HTTPException(status_code=404, detail="Plan file not found")

    content = container.get_blob_client(file_blob.name).download_blob().readall()
    df = pd.read_excel(io.BytesIO(content), sheet_name="Sheet1")

    str_cols = ["custom_region_name", "contract_name", "work_package_name"]
    monthly_cols = (
        [f"target_sockets_{i}" for i in range(1, 13)]
        + [f"planned_sockets_{i}" for i in range(1, 13)]
    )
    # Ensure every monthly column exists even if absent in the sheet
    for col in monthly_cols:
        if col not in df.columns:
            df[col] = 0

    result = df[str_cols + monthly_cols].copy()
    result[str_cols] = result[str_cols].fillna("").astype(str)
    result[monthly_cols] = result[monthly_cols].fillna(0)
    return result.to_dict(orient="records")


@app.get("/api/plans/{plan_id}/file")
def get_plan_file(plan_id: str):
    container = get_container_client()
    file_blob = next(
        (
            b
            for b in container.list_blobs(name_starts_with=f"{plan_id}/")
            if not b.name.endswith("metadata.json") and not b.name.endswith("metrics.json")
        ),
        None,
    )
    if not file_blob:
        raise HTTPException(status_code=404, detail="File not found")

    client = container.get_blob_client(file_blob.name)
    filename = file_blob.name.split("/")[-1]

    def stream():
        yield from client.download_blob().chunks()

    return StreamingResponse(
        stream(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Serve built React app in production ─────────────────────────────────────
# `npm run build` outputs to ./dist; FastAPI serves it as static files.
# In development, Vite's dev server handles the frontend (see vite.config.ts).

if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
