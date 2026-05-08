import io
import json
import math
import os
import re
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
from fastapi.responses import FileResponse, StreamingResponse
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
MPP_CONVERTER_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING_MPP_CONVERTER", "")
MPP_CONVERTER_INPUT_CONTAINER_NAME = os.getenv(
    "AZURE_STORAGE_CONTAINER_MPP_CONVERTER_IN",
    "mppinputnew",
)
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

TARGET_SOCKET_MONTHS = 18
METRICS_TARGET_SOCKET_MONTHS = 12


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
    target_sockets_13: Optional[int] = None
    target_sockets_14: Optional[int] = None
    target_sockets_15: Optional[int] = None
    target_sockets_16: Optional[int] = None
    target_sockets_17: Optional[int] = None
    target_sockets_18: Optional[int] = None
    planned_gate_1: Optional[int] = None
    planned_gate_2: Optional[int] = None
    planned_gate_3: Optional[int] = None
    planned_gate_4: Optional[int] = None
    forecast_gate_1: Optional[int] = None
    forecast_gate_2: Optional[int] = None
    forecast_gate_3: Optional[int] = None
    forecast_gate_4: Optional[int] = None


class AssumptionsUpdateBody(BaseModel):
    senior_delivery_manager: float = Field(gt=0)
    delivery_manager: float = Field(gt=0)
    installer_resource_per_site_per_week: float = Field(gt=0)
    avg_sockets_per_sites: float = Field(gt=0)
    asset_value_per_sites: float = Field(ge=0)


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


def get_mpp_converter_input_container_client():
    if not MPP_CONVERTER_CONNECTION_STRING:
        raise HTTPException(
            status_code=500,
            detail="AZURE_STORAGE_CONNECTION_STRING_MPP_CONVERTER is not configured",
        )
    service = BlobServiceClient.from_connection_string(MPP_CONVERTER_CONNECTION_STRING)
    container = service.get_container_client(MPP_CONVERTER_INPUT_CONTAINER_NAME)
    try:
        container.create_container()
    except Exception:
        pass
    return container


def safe_upload_filename(filename: str | None) -> str:
    return (filename or "").replace("\\", "/").split("/")[-1].strip()


def upload_mpp_for_conversion(filename: str, content: bytes) -> str:
    container = get_mpp_converter_input_container_client()
    container.get_blob_client(filename).upload_blob(content, overwrite=True)
    return filename


# ─── Metrics calculation (from SQL rows + assumptions.json) ───────────────────
def compute_metrics_from_rows(rows: list[dict]) -> dict:
    target_sockets = sum(r["target_sockets"] for r in rows)
    monthly_sockets = [
        sum(r.get(f"target_sockets_{month}", 0) or 0 for r in rows)
        for month in range(1, 13)
    ]
    max_monthly_sockets = max(monthly_sockets, default=0)
    installer_resource_per_site_per_week = ASSUMPTIONS["installer_resource_per_site_per_week"]
    max_installer_resource_required = math.ceil((max_monthly_sockets / 5) / 4 * installer_resource_per_site_per_week)

    bom_capex = sum(r["target_sockets"] * float(r["capex_bom_per_socket"]) for r in rows)
    installation_capex = sum(r["target_sockets"] * float(r["capex_installation_per_socket"]) for r in rows)
    connection_capex = sum(r["target_sockets"] * float(r["capex_connection_per_socket"]) for r in rows)
    total_capex = sum(r["target_sockets"] * float(r["total_capex_per_socket"]) for r in rows)

    sr_capacity = ASSUMPTIONS["delivery_capacity_sockets_per_year"]["senior_delivery_manager"]
    dm_capacity = ASSUMPTIONS["delivery_capacity_sockets_per_year"]["delivery_manager"]
    asset_value_per_socket = ASSUMPTIONS["value_per_socket"]["asset_value_per_socket"]

    return {
        "target_sockets": target_sockets,
        "max_installer_resource_required": max_installer_resource_required,
        "capex": {
            "total": total_capex,
            "bom": bom_capex,
            "installation": installation_capex,
            "connection": connection_capex,
        },
        "workforce": {
            "senior_delivery_managers_required": math.ceil(target_sockets / sr_capacity) if sr_capacity else 0,
            "delivery_managers_required": math.ceil(target_sockets / dm_capacity) if dm_capacity else 0,
        },
        "asset_value": float(target_sockets * asset_value_per_socket),
    }
'''
#This is an alternative function to compute the total INCCURED CAPEX in 2026
def compute_metrics_from_rows(rows: list[dict], plan_year: int = 2026) -> dict:
    target_sockets = sum(
        sum(
            r.get(f"target_sockets_{month}", 0) or 0
            for month in range(1, METRICS_TARGET_SOCKET_MONTHS + 1)
        )
        for r in rows
    )
    monthly_sockets = [
        sum(r.get(f"target_sockets_{month}", 0) or 0 for r in rows)
        for month in range(1, METRICS_TARGET_SOCKET_MONTHS + 1)
    ]
    max_monthly_sockets = max(monthly_sockets, default=0)
    installer_resource_per_site_per_week = ASSUMPTIONS["installer_resource_per_site_per_week"]
    max_installer_resource_required = math.ceil((max_monthly_sockets / 5) / 4 * installer_resource_per_site_per_week)

    incurred_capex = compute_incurred_capex_from_rows(rows)
    monthly_by_type = pd.DataFrame(incurred_capex["monthly_by_type"])
    capex_by_type = {"bom": 0.0, "installation": 0.0, "connection": 0.0}
    total_capex = 0.0
    if not monthly_by_type.empty:
        monthly_by_type["incurred_month"] = pd.to_datetime(
            monthly_by_type["incurred_month"],
            errors="coerce",
        )
        monthly_by_type["incurred_cost"] = pd.to_numeric(
            monthly_by_type["incurred_cost"],
            errors="coerce",
        ).fillna(0.0)
        yearly_capex = monthly_by_type[
            monthly_by_type["incurred_month"].dt.year.eq(plan_year)
        ].copy()
        if not yearly_capex.empty:
            totals_by_month = yearly_capex.groupby(
                ["incurred_month"],
                as_index=False,
            )["incurred_cost"].sum()
            total_capex = float(totals_by_month["incurred_cost"].sum())
            yearly_by_type = yearly_capex.groupby("cost_type")["incurred_cost"].sum()
            for cost_type in capex_by_type:
                capex_by_type[cost_type] = float(yearly_by_type.get(cost_type, 0.0))

    sr_capacity = ASSUMPTIONS["delivery_capacity_sockets_per_year"]["senior_delivery_manager"]
    dm_capacity = ASSUMPTIONS["delivery_capacity_sockets_per_year"]["delivery_manager"]
    asset_value_per_socket = ASSUMPTIONS["value_per_socket"]["asset_value_per_socket"]

    return {
        "target_sockets": target_sockets,
        "max_installer_resource_required": max_installer_resource_required,
        "capex": {
            "total": total_capex,
            "bom": capex_by_type["bom"],
            "installation": capex_by_type["installation"],
            "connection": capex_by_type["connection"],
        },
        "workforce": {
            "senior_delivery_managers_required": math.ceil(target_sockets / sr_capacity) if sr_capacity else 0,
            "delivery_managers_required": math.ceil(target_sockets / dm_capacity) if dm_capacity else 0,
        },
        "asset_value": float(target_sockets * asset_value_per_socket),
    }
'''

def collapse_target_sockets_to_latest_month(df: pd.DataFrame) -> pd.DataFrame:
    """Collapse each row's target sockets into its latest non-zero target month."""
    df_new = df.copy()
    target_cols = [
        col
        for col in df_new.columns
        if re.fullmatch(r"target_sockets_\d+", str(col))
    ]
    if not target_cols:
        return df_new

    target_cols = sorted(target_cols, key=lambda col: int(col.rsplit("_", 1)[1]))
    df_new[target_cols] = df_new[target_cols].apply(
        pd.to_numeric,
        errors="coerce",
    ).fillna(0)

    active = df_new[target_cols].ne(0)
    has_active = active.any(axis=1)
    row_sums = df_new[target_cols].sum(axis=1)
    latest_cols = active.iloc[:, ::-1].idxmax(axis=1)

    df_new[target_cols] = 0
    for idx in df_new.index[has_active]:
        df_new.at[idx, latest_cols.at[idx]] = row_sums.at[idx]

    if "target_sockets" in df_new.columns:
        df_new["target_sockets"] = row_sums

    return df_new


def compute_incurred_capex_from_rows(
    rows: list[dict],
    target_month_1: str = "2026-01-01",
) -> dict:
    """Calculate incurred CAPEX timing from SQL rows and assumptions.json.

    This mirrors notebook/capex_calculation.py while returning JSON-safe rows for
    the React charts.
    """
    if not rows:
        return {"target_month_1": target_month_1, "detail": [], "monthly_by_type": []}

    df = pd.DataFrame(rows)
    group_cols = ["region_name", "contract_name", "work_package_name"]
    target_cols = [f"target_sockets_{i}" for i in range(1, TARGET_SOCKET_MONTHS + 1)]
    payment_schedule = pd.DataFrame(ASSUMPTIONS["payment_schedule"])
    if "payment_installment" not in payment_schedule.columns:
        payment_schedule["payment_installment"] = (
            payment_schedule.groupby("cost_type").cumcount() + 1
        )
    payment_schedule["payment_installment"] = pd.to_numeric(
        payment_schedule["payment_installment"],
        errors="coerce",
    ).fillna(0).astype(int)
    cost_cols = sorted(payment_schedule["cost_column"].unique())

    for col in group_cols:
        if col not in df.columns:
            df[col] = ""
    for col in target_cols:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    for col in cost_cols:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    df = collapse_target_sockets_to_latest_month(df)
    start_month = pd.Timestamp(target_month_1).to_period("M").to_timestamp()
    socket_long = df.melt(
        id_vars=group_cols + cost_cols,
        value_vars=target_cols,
        var_name="target_socket_column",
        value_name="monthly_target_sockets",
    )
    socket_long["target_sockets"] = pd.to_numeric(
        socket_long["monthly_target_sockets"],
        errors="coerce",
    ).fillna(0)
    socket_long = socket_long.drop(columns=["monthly_target_sockets"])
    socket_long = socket_long[socket_long["target_sockets"] != 0].copy()

    if socket_long.empty:
        return {"target_month_1": target_month_1, "detail": [], "monthly_by_type": []}

    socket_long["target_month_number"] = (
        socket_long["target_socket_column"].str.extract(r"(\d+)$").astype(int)
    )
    socket_long["target_month_end"] = socket_long["target_month_number"].apply(
        lambda month_no: start_month + pd.DateOffset(months=int(month_no) - 1) + pd.offsets.MonthEnd(0)
    )

    detail = socket_long.merge(payment_schedule, how="cross")
    detail["cost_per_socket"] = 0.0
    for cost_column in cost_cols:
        mask = detail["cost_column"].eq(cost_column)
        detail.loc[mask, "cost_per_socket"] = detail.loc[mask, cost_column]

    detail["incurred_date"] = detail["target_month_end"] + pd.to_timedelta(
        detail["offset_days"],
        unit="D",
    )
    detail["incurred_month"] = detail["incurred_date"].dt.to_period("M").dt.to_timestamp("M")
    detail["incurred_cost"] = (
        detail["target_sockets"] * detail["cost_per_socket"] * detail["payment_pct"]
    )

    monthly_by_type = (
        detail.groupby(group_cols + ["incurred_month", "cost_type"], as_index=False)[
            "incurred_cost"
        ]
        .sum()
        .sort_values(group_cols + ["incurred_month", "cost_type"])
    )

    detail_out = detail[
        group_cols
        + [
            "cost_type",
            "payment_installment",
            "offset_days",
            "target_sockets",
            "incurred_month",
            "incurred_cost",
        ]
    ].copy()
    monthly_out = monthly_by_type.copy()

    for frame in (detail_out, monthly_out):
        frame["incurred_month"] = frame["incurred_month"].dt.strftime("%Y-%m-%d")
        frame["incurred_cost"] = frame["incurred_cost"].astype(float)

    return {
        "target_month_1": target_month_1,
        "detail": detail_out.to_dict(orient="records"),
        "monthly_by_type": monthly_out.to_dict(orient="records"),
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


@app.put("/api/assumptions")
def update_assumptions(body: AssumptionsUpdateBody):
    asset_value_per_socket = body.asset_value_per_sites / body.avg_sockets_per_sites
    updated = {
        **ASSUMPTIONS,
        "delivery_capacity_sockets_per_year": {
            **ASSUMPTIONS.get("delivery_capacity_sockets_per_year", {}),
            "senior_delivery_manager": body.senior_delivery_manager,
            "delivery_manager": body.delivery_manager,
        },
        "installer_resource_per_site_per_week": body.installer_resource_per_site_per_week,
        "avg_sockets_per_sites": body.avg_sockets_per_sites,
        "asset_value_per_sites": body.asset_value_per_sites,
        "value_per_socket": {
            **ASSUMPTIONS.get("value_per_socket", {}),
            "asset_value_per_socket": asset_value_per_socket,
        },
    }

    try:
        _ASSUMPTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_ASSUMPTIONS_PATH, "w", encoding="utf-8") as f:
            json.dump(updated, f, indent=2)
            f.write("\n")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not save assumptions: {exc}") from exc

    ASSUMPTIONS.clear()
    ASSUMPTIONS.update(updated)
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


# ─── Data ingestion ───────────────────────────────────────────────────────────

def _transform_stage_gates(df: pd.DataFrame) -> pd.DataFrame:
    """Transpose week-columns into planned/actual gate columns.

    Input: raw Sheet1 DataFrame with a 'Work Package' column and integer week
    columns (1–52) whose cells contain stage gate numbers 1–4.
    Output: one row per work package with planned_gate_1..4 (week numbers) and
    forecast_gate_1..4 (looked up per-row from the same week columns).
    """
    week_columns = [col for col in df.columns if isinstance(col, (int, float)) and not pd.isna(col)]
    week_columns = [int(c) for c in week_columns]

    # Build a lookup: work_package_name -> original row Series for actual gate lookup
    original_rows: dict = {}
    transformed_data = []

    for _, row in df.iterrows():
        work_package = row.get("Work Package", "")
        original_rows[work_package] = row
        stage_gate_dict: dict = {"work_package_name": work_package}

        for week in week_columns:
            val = row.get(week)
            if val in [1, 2, 3, 4]:
                key = f"planned_gate_{int(val)}"
                if key not in stage_gate_dict:
                    stage_gate_dict[key] = week
        transformed_data.append(stage_gate_dict)

    df_transformed = pd.DataFrame(transformed_data)

    column_order = ["work_package_name", "planned_gate_1", "planned_gate_2", "planned_gate_3", "planned_gate_4"]
    df_transformed = df_transformed[[col for col in column_order if col in df_transformed.columns]]

    for gate_num in range(1, 5):
        planned_col = f"planned_gate_{gate_num}"
        actual_col = f"actual_gate_{gate_num}"

        def _lookup_actual(row_t, pc=planned_col, orig=original_rows, wc=week_columns):
            week = row_t.get(pc)
            if pd.isna(week) if isinstance(week, float) else week is None:
                return None
            week = int(week)
            orig_row = orig.get(row_t["work_package_name"])
            if orig_row is None or week not in wc:
                return None
            v = orig_row.get(week)
            return int(v) if pd.notna(v) else None

        df_transformed[actual_col] = df_transformed.apply(_lookup_actual, axis=1)

    return df_transformed


@app.post("/api/data-ingestion/stage-gates", status_code=201)
async def upload_stage_gates(
    plan_year: int = Form(...),
    file: UploadFile = File(...),
):
    import db as _db

    filename = safe_upload_filename(file.filename)
    if not filename:
        raise HTTPException(status_code=400, detail="File name is required")

    name_lower = filename.lower()
    if not name_lower.endswith(".xlsx") and not name_lower.endswith(".xls"):
        raise HTTPException(status_code=400, detail="Upload an Excel file (.xlsx or .xls)")

    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content), sheet_name="Sheet1")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read Sheet1: {exc}") from exc

    if "Work Package" not in df.columns:
        raise HTTPException(status_code=400, detail="Sheet1 must contain a 'Work Package' column")

    df_transformed = _transform_stage_gates(df)

    sg_plan_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    _db.create_stage_gate_plan(sg_plan_id, filename, plan_year, created_at)
    row_count = _db.sync_stage_gate_rows(sg_plan_id, df_transformed)

    return {"fileName": filename, "planYear": plan_year, "rowCount": row_count, "sgPlanId": sg_plan_id}


@app.post("/api/data-ingestion/mpp", status_code=201)
async def upload_mpp(file: UploadFile = File(...)):
    import db as _db

    filename = safe_upload_filename(file.filename)
    if not filename:
        raise HTTPException(status_code=400, detail="MPP file name is required")

    if not filename.lower().endswith(".mpp"):
        raise HTTPException(status_code=400, detail="Upload a Microsoft Project .mpp file")

    work_package_name = Path(filename).stem.strip()
    if not work_package_name:
        raise HTTPException(status_code=400, detail="MPP file name must include a work package name")

    if not _db.work_package_name_exists(work_package_name):
        raise HTTPException(
            status_code=400,
            detail=(
                "MPP file name must match a Work Package in the uploaded plan rows. "
                f"No Work Package matched '{work_package_name}'."
            ),
        )

    content = await file.read()
    blob_name = upload_mpp_for_conversion(filename, content)
    return {"fileName": filename, "blobName": blob_name}


# ─── Plans CRUD (metadata in SQL, Excel in blob) ──────────────────────────────

@app.get("/api/plans")
def list_plans():
    import db as _db
    return _db.list_plans()


@app.post("/api/plans", status_code=201)
async def create_plan(
    name: str = Form(...),
    plan_year: int = Form(...),
    file: UploadFile = File(...),
):
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
        plan_year=plan_year,
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
    plan_year: Optional[int] = Form(None),
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
    if plan_year is not None:
        updates["plan_year"] = plan_year

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
    plan = _db.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    rows = _db.get_rows(plan_id)
    return compute_metrics_from_rows(rows)


@app.get("/api/plans/{plan_id}/rows")
def get_plan_rows(plan_id: str):
    import db as _db
    return _db.get_rows(plan_id)


@app.get("/api/plans/{plan_id}/capex-incurred")
def get_plan_capex_incurred(plan_id: str):
    import db as _db
    rows = _db.get_rows(plan_id)
    return compute_incurred_capex_from_rows(rows)


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

DIST_DIR = Path("dist")
INDEX_FILE = DIST_DIR / "index.html"

if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(INDEX_FILE)

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")

        static_file = (DIST_DIR / full_path).resolve()
        if static_file.is_file() and DIST_DIR.resolve() in static_file.parents:
            return FileResponse(static_file)

        return FileResponse(INDEX_FILE)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
