"""Report submission (with the 112 gate) and the reporter's own reports."""

import secrets
import sqlite3
from datetime import timedelta

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from ..config import Settings
from ..db import iso, utcnow
from ..deps import current_user, get_db, get_settings, optional_user
from ..domain import verification
from ..errors import api_error, validation_error_body
from ..safety import emergency_reasons, emergency_response_body
from ..schemas import ReportCreate

router = APIRouter(prefix="/reports", tags=["reports"])

# No 0/O/1/I to keep IDs easy to read aloud.
_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def new_public_id() -> str:
    return "SF-" + "".join(secrets.choice(_ID_ALPHABET) for _ in range(8))


def own_report_out(row: sqlite3.Row) -> dict:
    return {
        "public_id": row["public_id"],
        "category": row["category"],
        "description": row["description"],
        "lat": row["lat"],
        "lon": row["lon"],
        "location_source": row["location_source"],
        "observed_at": row["observed_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "status": row["status"],
        "source_type": row["source_type"],
        "is_simulated": bool(row["is_simulated"]),
        "verification": verification(row["status"]),
        # Held = not on the public map until a reviewer looks at it. The reviewer's private note is never included.
        "public_visibility": row["public_visibility"],
        "rejection_reason": row["rejection_reason"],
    }


@router.post("", status_code=201)
def create_report(
    payload: dict = Body(...),
    user: sqlite3.Row | None = Depends(optional_user),
    settings: Settings = Depends(get_settings),
    db: sqlite3.Connection = Depends(get_db),
):
    # 1. The 112 gate runs first, on raw input, before auth or validation, so it can never be skipped.
    reasons = emergency_reasons(payload.get("category"), payload.get("description"), payload.get("immediate_danger"))
    if reasons:
        return JSONResponse(status_code=400, content={"detail": emergency_response_body(reasons)})

    if user is None:
        raise api_error(401, "not_authenticated", "Trebuie să fiți autentificat.")

    try:
        report = ReportCreate.model_validate(payload)
    except ValidationError as exc:
        return JSONResponse(status_code=422, content=validation_error_body(exc.errors()))

    now = utcnow()
    since = iso(now - timedelta(hours=1))
    count = db.execute(
        "SELECT COUNT(*) FROM reports WHERE reporter_id = ? AND created_at >= ?", (user["id"], since)
    ).fetchone()[0]
    if count >= settings.report_rate_limit_per_hour:
        raise api_error(429, "rate_limited", "Ați trimis prea multe rapoarte într-o oră. Încercați mai târziu.")

    public_id = new_public_id()
    with db:
        db.execute(
            """INSERT INTO reports (public_id, reporter_id, category, description, lat, lon, location_source,
                   gps_accuracy_m, observed_at, created_at, updated_at, source_type, is_simulated, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user_report', 0, 'submitted')""",
            (
                public_id, user["id"], report.category, report.description, report.lat, report.lon,
                report.location_source, report.gps_accuracy_m, iso(report.observed_at), iso(now), iso(now),
            ),
        )
    row = db.execute("SELECT * FROM reports WHERE public_id = ?", (public_id,)).fetchone()
    return own_report_out(row)


@router.get("/mine")
def my_reports(user: sqlite3.Row = Depends(current_user), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC, id DESC", (user["id"],)
    ).fetchall()
    return [own_report_out(r) for r in rows]
