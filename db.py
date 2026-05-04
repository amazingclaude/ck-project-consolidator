"""Azure SQL helpers for the CK Project Consolidator.

Plan metadata and row data live in Azure SQL.
Blob storage is used only for uploaded Excel file storage.
"""

import os
from contextlib import contextmanager
from typing import Iterator, Optional

import pandas as pd
from fastapi import HTTPException

try:
    import pyodbc as _pyodbc  # type: ignore
    _PYODBC_OK = True
except ImportError:
    _pyodbc = None  # type: ignore
    _PYODBC_OK = False

AZURE_SQL_CONNECTION_STRING: str = os.getenv("AZURE_SQL_CONNECTION_STRING", "")

_SOCKET_COLS = [f"target_sockets_{i}" for i in range(1, 13)]
_GATE_COLS = [f"planned_gate_{i}" for i in range(1, 5)] + [
    f"actual_gate_{i}" for i in range(1, 5)
]
_CAPEX_COLS = [
    "capex_bom_per_socket",
    "capex_installation_per_socket",
    "capex_connection_per_socket",
    "total_capex_per_socket",
]
_EDITABLE_COLS = frozenset(
    {"region_name", "contract_name", "work_package_name", "target_sockets"}
    | set(_CAPEX_COLS)
    | set(_SOCKET_COLS)
    | set(_GATE_COLS)
)


def _require_sql() -> None:
    if not _PYODBC_OK:
        raise HTTPException(
            status_code=503,
            detail="pyodbc is not installed. Add pyodbc to requirements.txt and redeploy.",
        )
    if not AZURE_SQL_CONNECTION_STRING:
        raise HTTPException(
            status_code=503,
            detail="AZURE_SQL_CONNECTION_STRING is not configured.",
        )


@contextmanager
def get_db() -> Iterator:
    _require_sql()
    conn = _pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ─── Plans ────────────────────────────────────────────────────────────────────

_PLAN_COLS = "plan_id, plan_name, blob_path, file_name, file_size, file_type, created_at, status"


def _row_to_plan(row) -> dict:
    return {
        "id": row[0],
        "name": row[1],
        "blob_path": row[2] or "",
        "fileName": row[3] or "",
        "fileSize": int(row[4]) if row[4] else 0,
        "fileType": row[5] or "",
        "createdAt": row[6].isoformat() if row[6] else "",
        "status": row[7] or "active",
    }


def create_plan(
    plan_id: str,
    plan_name: str,
    blob_path: str,
    file_name: str,
    file_size: int,
    file_type: str,
    created_at: str,
) -> dict:
    with get_db() as conn:
        conn.cursor().execute(
            f"INSERT INTO plans ({_PLAN_COLS}) VALUES (?,?,?,?,?,?,?,'active')",
            (plan_id, plan_name, blob_path, file_name, file_size, file_type, created_at),
        )
    return {
        "id": plan_id,
        "name": plan_name,
        "blob_path": blob_path,
        "fileName": file_name,
        "fileSize": file_size,
        "fileType": file_type,
        "createdAt": created_at,
        "status": "active",
    }


def get_plan(plan_id: str) -> Optional[dict]:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT {_PLAN_COLS} FROM plans WHERE plan_id = ?", (plan_id,))
        row = cur.fetchone()
        return _row_to_plan(row) if row else None


def list_plans() -> list[dict]:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT {_PLAN_COLS} FROM plans ORDER BY created_at DESC")
        return [_row_to_plan(r) for r in cur.fetchall()]


def update_plan(plan_id: str, **kwargs) -> Optional[dict]:
    allowed = {"plan_name", "status", "blob_path", "file_name", "file_size", "file_type"}
    parts, params = [], []
    for k, v in kwargs.items():
        if k in allowed and v is not None:
            parts.append(f"{k} = ?")
            params.append(v)
    if parts:
        params.append(plan_id)
        with get_db() as conn:
            conn.cursor().execute(
                f"UPDATE plans SET {', '.join(parts)} WHERE plan_id = ?", params
            )
    return get_plan(plan_id)


def delete_plan(plan_id: str) -> None:
    with get_db() as conn:
        conn.cursor().execute("DELETE FROM plans WHERE plan_id = ?", (plan_id,))


# ─── Rows ─────────────────────────────────────────────────────────────────────

def sync_rows(plan_id: str, df: pd.DataFrame) -> int:
    """Delete existing rows for plan_id then bulk-insert from DataFrame.

    Accepts either 'region_name' or legacy 'custom_region_name'.
    Stores source columns only — no CAPEX totals calculated here.
    """
    df = df.copy()

    if "custom_region_name" in df.columns and "region_name" not in df.columns:
        df.rename(columns={"custom_region_name": "region_name"}, inplace=True)

    for col in ("region_name", "contract_name", "work_package_name"):
        if col not in df.columns:
            df[col] = ""
        else:
            df[col] = df[col].fillna("").astype(str)

    for col in _CAPEX_COLS:
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    for col in _SOCKET_COLS:
        if col not in df.columns:
            df[col] = 0
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

    for col in _GATE_COLS:
        if col not in df.columns:
            df[col] = None
        else:
            weeks = pd.to_numeric(df[col], errors="coerce")
            df[col] = [int(value) if pd.notna(value) else None for value in weeks]

    if "target_sockets" in df.columns:
        df["target_sockets"] = pd.to_numeric(df["target_sockets"], errors="coerce").fillna(0).astype(int)
    else:
        df["target_sockets"] = df[_SOCKET_COLS].sum(axis=1).astype(int)

    def optional_int(value):
        return int(value) if pd.notna(value) else None

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM plan_rows WHERE plan_id = ?", (plan_id,))
        for _, row in df.iterrows():
            cur.execute(
                """
                INSERT INTO plan_rows (
                    plan_id, region_name, contract_name, work_package_name,
                    capex_bom_per_socket, capex_installation_per_socket,
                    capex_connection_per_socket, total_capex_per_socket,
                    target_sockets,
                    target_sockets_1,  target_sockets_2,  target_sockets_3,
                    target_sockets_4,  target_sockets_5,  target_sockets_6,
                    target_sockets_7,  target_sockets_8,  target_sockets_9,
                    target_sockets_10, target_sockets_11, target_sockets_12,
                    planned_gate_1, planned_gate_2, planned_gate_3, planned_gate_4,
                    actual_gate_1,  actual_gate_2,  actual_gate_3,  actual_gate_4
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    plan_id,
                    str(row["region_name"]),
                    str(row["contract_name"]),
                    str(row["work_package_name"]),
                    float(row["capex_bom_per_socket"]),
                    float(row["capex_installation_per_socket"]),
                    float(row["capex_connection_per_socket"]),
                    float(row["total_capex_per_socket"]),
                    int(row["target_sockets"]),
                    *[int(row[f"target_sockets_{i}"]) for i in range(1, 13)],
                    *[optional_int(row[col]) for col in _GATE_COLS],
                ),
            )
    return len(df)


def get_rows(plan_id: str) -> list[dict]:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT row_id, region_name, contract_name, work_package_name,
                   capex_bom_per_socket, capex_installation_per_socket,
                   capex_connection_per_socket, total_capex_per_socket,
                   target_sockets,
                   target_sockets_1,  target_sockets_2,  target_sockets_3,
                   target_sockets_4,  target_sockets_5,  target_sockets_6,
                   target_sockets_7,  target_sockets_8,  target_sockets_9,
                   target_sockets_10, target_sockets_11, target_sockets_12,
                   planned_gate_1, planned_gate_2, planned_gate_3, planned_gate_4,
                   actual_gate_1,  actual_gate_2,  actual_gate_3,  actual_gate_4
            FROM plan_rows WHERE plan_id = ?
            ORDER BY row_id
            """,
            (plan_id,),
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def update_row(row_id: int, data: dict) -> None:
    parts, params = [], []
    for k, v in data.items():
        if k in _EDITABLE_COLS:
            parts.append(f"{k} = ?")
            params.append(v)
    if not parts:
        return
    params.append(row_id)
    with get_db() as conn:
        conn.cursor().execute(
            f"UPDATE plan_rows SET {', '.join(parts)} WHERE row_id = ?", params
        )
