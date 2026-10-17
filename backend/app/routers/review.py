"""Private reviewer queue. Every status change writes an audit entry in the same transaction."""

import hashlib
import hmac
import sqlite3

from fastapi import APIRouter, Depends, Query

from ..config import Settings
from ..db import iso, utcnow
from ..deps import get_db, get_settings, require_reviewer
from ..domain import TRANSITIONS
from ..errors import api_error
from ..schemas import StatusChange

router = APIRouter(prefix="/review", tags=["review"])


def reporter_ref(secret: str, reporter_id: int) -> str:
    """Opaque, stable pseudonym so reviewers can spot repeat submitters without seeing who they are."""
    digest = hmac.new(secret.encode(), f"reporter:{reporter_id}".encode(), hashlib.sha256).hexdigest()
    return "R-" + digest[:8]


def review_report_out(row: sqlite3.Row, secret: str) -> dict:
    return {
        "public_id": row["public_id"],
        "category": row["category"],
        "description": row["description"],
        "lat": row["lat"],
        "lon": row["lon"],
        "location_source": row["location_source"],
        "gps_accuracy_m": row["gps_accuracy_m"],
        "observed_at": row["observed_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "status": row["status"],
        "allowed_next": sorted(TRANSITIONS[row["status"]]),
        "source_type": row["source_type"],
        "is_simulated": bool(row["is_simulated"]),
        "reporter_ref": reporter_ref(secret, row["reporter_id"]),
    }


def audit_out(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "report_id": row["public_id"],
        "reviewer_email": row["reviewer_email"],
        "action": row["action"],
        "from_status": row["from_status"],
        "to_status": row["to_status"],
        "notes": row["notes"],
        "created_at": row["created_at"],
    }


_AUDIT_SELECT = """SELECT a.*, r.public_id, u.email AS reviewer_email
                   FROM review_actions a JOIN reports r ON r.id = a.report_id JOIN users u ON u.id = a.reviewer_id"""


def _get_report(db: sqlite3.Connection, public_id: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM reports WHERE public_id = ?", (public_id.upper(),)).fetchone()
    if row is None:
        raise api_error(404, "not_found", "Raportul nu a fost găsit.")
    return row


@router.get("/reports")
def queue(
    status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    sort: str = Query(default="newest", pattern="^(newest|oldest)$"),
    _: sqlite3.Row = Depends(require_reviewer),
    settings: Settings = Depends(get_settings),
    db: sqlite3.Connection = Depends(get_db),
):
    sql, params = "SELECT * FROM reports WHERE 1=1", []
    if status:
        sql += " AND status = ?"
        params.append(status)
    if category:
        sql += " AND category = ?"
        params.append(category)
    sql += " ORDER BY created_at " + ("DESC" if sort == "newest" else "ASC") + ", id"
    return [review_report_out(r, settings.secret_key) for r in db.execute(sql, params).fetchall()]


@router.get("/reports/{public_id}")
def report_detail(
    public_id: str,
    _: sqlite3.Row = Depends(require_reviewer),
    settings: Settings = Depends(get_settings),
    db: sqlite3.Connection = Depends(get_db),
):
    return review_report_out(_get_report(db, public_id), settings.secret_key)


@router.post("/reports/{public_id}/status")
def change_status(
    public_id: str,
    body: StatusChange,
    reviewer: sqlite3.Row = Depends(require_reviewer),
    settings: Settings = Depends(get_settings),
    db: sqlite3.Connection = Depends(get_db),
):
    row = _get_report(db, public_id)
    current = row["status"]
    if body.status not in TRANSITIONS[current]:
        raise api_error(
            409, "invalid_transition", f"Nu se poate trece din „{current}” în „{body.status}”.",
            allowed=sorted(TRANSITIONS[current]),
        )
    now = iso(utcnow())
    with db:  # one transaction: status + audit entry, or neither
        db.execute("UPDATE reports SET status = ?, updated_at = ? WHERE id = ?", (body.status, now, row["id"]))
        db.execute(
            """INSERT INTO review_actions (report_id, reviewer_id, action, from_status, to_status, notes, created_at)
               VALUES (?, ?, 'status_change', ?, ?, ?, ?)""",
            (row["id"], reviewer["id"], current, body.status, body.notes.strip() or None, now),
        )
    return review_report_out(_get_report(db, public_id), settings.secret_key)


@router.get("/reports/{public_id}/audit")
def report_audit(public_id: str, _: sqlite3.Row = Depends(require_reviewer), db: sqlite3.Connection = Depends(get_db)):
    row = _get_report(db, public_id)
    rows = db.execute(_AUDIT_SELECT + " WHERE a.report_id = ? ORDER BY a.id", (row["id"],)).fetchall()
    return [audit_out(r) for r in rows]


@router.get("/audit")
def audit_log(
    limit: int = Query(default=200, ge=1, le=1000),
    _: sqlite3.Row = Depends(require_reviewer),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute(_AUDIT_SELECT + " ORDER BY a.id DESC LIMIT ?", (limit,)).fetchall()
    return [audit_out(r) for r in rows]
