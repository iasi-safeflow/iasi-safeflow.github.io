"""Public, unauthenticated endpoints. Only privacy-safe fields: no description, reporter, exact time or exact location."""

import sqlite3

from fastapi import APIRouter, Depends, Query

from ..deps import get_db
from ..domain import PUBLIC_COORD_DECIMALS, PUBLIC_HIDDEN_STATUSES
from ..errors import api_error

router = APIRouter(prefix="/public", tags=["public"])

_HIDDEN = ",".join("?" * len(PUBLIC_HIDDEN_STATUSES))


def public_report_out(row: sqlite3.Row) -> dict:
    return {
        "public_id": row["public_id"],
        "category": row["category"],
        "status": row["status"],
        "lat": round(row["lat"], PUBLIC_COORD_DECIMALS),
        "lon": round(row["lon"], PUBLIC_COORD_DECIMALS),
        "observed_date": row["observed_at"][:10],
        "updated_date": row["updated_at"][:10],
        "source_type": row["source_type"],
        "is_simulated": bool(row["is_simulated"]),
        "verification": "unverified",
    }


@router.get("/reports")
def public_reports(
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: sqlite3.Connection = Depends(get_db),
):
    sql = f"SELECT * FROM reports WHERE status NOT IN ({_HIDDEN})"
    params: list = list(PUBLIC_HIDDEN_STATUSES)
    if category:
        sql += " AND category = ?"
        params.append(category)
    if status:
        sql += " AND status = ?"
        params.append(status)
    sql += " ORDER BY observed_at DESC LIMIT 1000"
    return [public_report_out(r) for r in db.execute(sql, params).fetchall()]


@router.get("/reports/{public_id}")
def public_report_status(public_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Status lookup by report ID (works for rejected reports too, so reporters see the outcome)."""
    row = db.execute("SELECT * FROM reports WHERE public_id = ?", (public_id.upper(),)).fetchone()
    if row is None:
        raise api_error(404, "not_found", "Raportul nu a fost găsit.")
    return public_report_out(row)
