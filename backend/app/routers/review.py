"""Private reviewer queue. Every status change writes an audit entry in the same transaction."""

import hashlib
import hmac
import sqlite3

from fastapi import APIRouter, Depends, Query

from ..assistant.config import ASSISTANT_VERSION
from ..assistant.runner import latest_runs, pair_decisions, recheck, run_out
from ..config import Settings
from ..db import iso, utcnow
from ..deps import get_db, get_settings, require_reviewer
from ..domain import PUBLISHING_STATUSES, TRANSITIONS, verification
from ..errors import api_error
from ..schemas import DuplicateDecision, StatusChange

router = APIRouter(prefix="/review", tags=["review"])


def reporter_ref(secret: str, reporter_id: int) -> str:
    """Opaque, stable pseudonym so reviewers can spot repeat submitters without seeing who they are."""
    digest = hmac.new(secret.encode(), f"reporter:{reporter_id}".encode(), hashlib.sha256).hexdigest()
    return "R-" + digest[:8]


def assistant_summary(run: sqlite3.Row | None) -> dict | None:
    """What the queue shows from the latest assistant check: importance, flag codes, strongest duplicate level."""
    if run is None:
        return None
    out = run_out(run)
    levels = {d["level"] for d in out["duplicates"]}
    return {
        "importance_score": out["importance"]["score"],
        "importance_level": out["importance"]["level"],
        "flags": [f["code"] for f in out["flags"]],
        "duplicate_level": "probable" if "probable" in levels else "possible" if levels else None,
        "checked_at": out["created_at"],
    }


def review_report_out(row: sqlite3.Row, secret: str, run: sqlite3.Row | None = None) -> dict:
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
        "rejection_reason": row["rejection_reason"],
        "public_visibility": row["public_visibility"],
        "verification": verification(row["status"]),
        "source_type": row["source_type"],
        "is_simulated": bool(row["is_simulated"]),
        "reporter_ref": reporter_ref(secret, row["reporter_id"]),
        "assistant": assistant_summary(run),
    }


def audit_out(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "report_id": row["public_id"],
        "reviewer_email": row["reviewer_email"],
        "action": row["action"],
        "from_status": row["from_status"],
        "to_status": row["to_status"],
        "reason": row["reason"],
        "related_report_id": row["related_public_id"],
        "notes": row["notes"],
        "created_at": row["created_at"],
    }


_AUDIT_SELECT = """SELECT a.*, r.public_id, u.email AS reviewer_email, rr.public_id AS related_public_id
                   FROM review_actions a JOIN reports r ON r.id = a.report_id JOIN users u ON u.id = a.reviewer_id
                   LEFT JOIN reports rr ON rr.id = a.related_report_id"""


def _get_report(db: sqlite3.Connection, public_id: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM reports WHERE public_id = ?", (public_id.upper(),)).fetchone()
    if row is None:
        raise api_error(404, "not_found", "Raportul nu a fost găsit.")
    return row


@router.get("/reports")
def queue(
    status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    visibility: str | None = Query(default=None, pattern="^(public|held)$"),
    sort: str = Query(default="newest", pattern="^(newest|oldest|importance)$"),
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
    if visibility:
        sql += " AND public_visibility = ?"
        params.append(visibility)
    sql += " ORDER BY created_at " + ("ASC" if sort == "oldest" else "DESC") + ", id"
    rows = db.execute(sql, params).fetchall()
    runs = latest_runs(db, [r["id"] for r in rows])
    items = [review_report_out(r, settings.secret_key, runs.get(r["id"])) for r in rows]
    if sort == "importance":  # stable sort: newest first within the same score; unchecked reports last
        items.sort(key=lambda i: -(i["assistant"]["importance_score"] if i["assistant"] else -1))
    return items


@router.get("/reports/{public_id}")
def report_detail(
    public_id: str,
    _: sqlite3.Row = Depends(require_reviewer),
    settings: Settings = Depends(get_settings),
    db: sqlite3.Connection = Depends(get_db),
):
    row = _get_report(db, public_id)
    return review_report_out(row, settings.secret_key, latest_runs(db, [row["id"]]).get(row["id"]))


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
    # A held report is published only by a reviewer's decision; rejecting keeps it hidden.
    visibility = "public" if body.status in PUBLISHING_STATUSES else row["public_visibility"]
    with db:  # one transaction: status + audit entry, or neither
        db.execute(
            "UPDATE reports SET status = ?, rejection_reason = ?, public_visibility = ?, updated_at = ? WHERE id = ?",
            (body.status, body.reason, visibility, now, row["id"]),
        )
        db.execute(
            """INSERT INTO review_actions (report_id, reviewer_id, action, from_status, to_status, reason, notes, created_at)
               VALUES (?, ?, 'status_change', ?, ?, ?, ?, ?)""",
            (row["id"], reviewer["id"], current, body.status, body.reason, body.notes.strip() or None, now),
        )
    return report_detail(public_id, reviewer, settings, db)


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


@router.get("/reports/{public_id}/assistant")
def report_assistant(public_id: str, _: sqlite3.Row = Depends(require_reviewer), db: sqlite3.Connection = Depends(get_db)):
    """Latest automatic analysis, with each duplicate candidate shown next to the reviewer's decision about the pair."""
    row = _get_report(db, public_id)
    run = latest_runs(db, [row["id"]]).get(row["id"])
    count = db.execute("SELECT COUNT(*) FROM assistant_runs WHERE report_id = ?", (row["id"],)).fetchone()[0]
    if run is None:
        return {"latest": None, "checks": count, "current_version": ASSISTANT_VERSION}
    out = run_out(run)
    decisions = pair_decisions(db, row["id"])
    for dup in out["duplicates"]:
        other = db.execute("SELECT * FROM reports WHERE public_id = ?", (dup["public_id"],)).fetchone()
        decision = decisions.get(other["id"])
        dup["report"] = {
            "public_id": other["public_id"],
            "category": other["category"],
            "description": other["description"],
            "status": other["status"],
            "observed_at": other["observed_at"],
            "created_at": other["created_at"],
            "is_simulated": bool(other["is_simulated"]),
        }
        dup["decision"] = decision["relation_type"] if decision else None
    # Linked pairs are no longer suggested, but stay listed so the link can be undone.
    out["confirmed_links"] = [
        {
            "public_id": db.execute("SELECT public_id FROM reports WHERE id = ?", (other_id,)).fetchone()[0],
            "role": "original" if d["report_id"] == row["id"] else "duplicate",
        }
        for other_id, d in decisions.items()
        if d["relation_type"] == "duplicate_confirmed"
    ]
    return {"latest": out, "checks": count, "current_version": ASSISTANT_VERSION}


@router.post("/reports/{public_id}/duplicates/{other_id}")
def decide_duplicate(
    public_id: str,
    other_id: str,
    body: DuplicateDecision,
    reviewer: sqlite3.Row = Depends(require_reviewer),
    settings: Settings = Depends(get_settings),
    db: sqlite3.Connection = Depends(get_db),
):
    """A reviewer's decision about a suggested pair. The newer report is always the duplicate; nothing is deleted."""
    row, other = _get_report(db, public_id), _get_report(db, other_id)
    if row["id"] == other["id"]:
        raise api_error(422, "same_report", "Un raport nu poate fi duplicatul lui însuși.")
    newer, older = sorted((row, other), key=lambda r: (r["created_at"], r["id"]), reverse=True)
    latest = pair_decisions(db, row["id"]).get(other["id"])
    linked = latest is not None and latest["relation_type"] == "duplicate_confirmed"
    now = iso(utcnow())
    notes = body.notes.strip() or None

    if body.action == "link":
        if linked:
            raise api_error(409, "already_linked", "Rapoartele sunt deja legate ca duplicat.")
        if older["status"] == "rejected":
            raise api_error(409, "original_rejected", "Raportul mai vechi este respins; nu poate fi raportul original.")
        if "rejected" not in TRANSITIONS[newer["status"]]:
            raise api_error(409, "invalid_transition", f"Raportul {newer['public_id']} nu poate fi respins din statusul curent.")
        relation, duplicate_change = "duplicate_confirmed", (newer["status"], "rejected", "duplicate")
    elif body.action == "revoke":
        if not linked:
            raise api_error(409, "not_linked", "Rapoartele nu sunt legate ca duplicat.")
        newer = db.execute("SELECT * FROM reports WHERE id = ?", (latest["report_id"],)).fetchone()
        older = db.execute("SELECT * FROM reports WHERE id = ?", (latest["related_report_id"],)).fetchone()
        # Reopen only while the report is still rejected because of this link; otherwise leave its status alone.
        reopen = newer["status"] == "rejected" and newer["rejection_reason"] == "duplicate"
        relation, duplicate_change = "duplicate_revoked", ((newer["status"], "under_review", None) if reopen else None)
    else:
        if linked:
            raise api_error(409, "already_linked", "Anulați întâi legătura de duplicat.")
        relation, duplicate_change = "not_duplicate", None

    action = {"link": "duplicate_link", "not_duplicate": "not_duplicate", "revoke": "duplicate_revoke"}[body.action]
    with db:
        db.execute(
            """INSERT INTO report_relations (report_id, related_report_id, relation_type, reviewer_id, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (newer["id"], older["id"], relation, reviewer["id"], now),
        )
        if duplicate_change:
            _, to_status, reason = duplicate_change
            visibility = "public" if to_status in PUBLISHING_STATUSES else newer["public_visibility"]
            db.execute(
                "UPDATE reports SET status = ?, rejection_reason = ?, public_visibility = ?, updated_at = ? WHERE id = ?",
                (to_status, reason, visibility, now, newer["id"]),
            )
        # One audit entry on each report, so both histories show the decision.
        for subject, related in ((newer, older), (older, newer)):
            change = duplicate_change if subject is newer and duplicate_change else (None, None, None)
            db.execute(
                """INSERT INTO review_actions (report_id, reviewer_id, action, from_status, to_status, reason, notes,
                       related_report_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (subject["id"], reviewer["id"], action, *change, notes, related["id"], now),
            )
    # The decision changes duplicates and corroboration for both reports: append a fresh check for each open one.
    for r in (newer, older):
        if db.execute("SELECT status FROM reports WHERE id = ?", (r["id"],)).fetchone()[0] != "rejected":
            recheck(db, r["id"], "reviewer_decision", utcnow())
    return report_detail(public_id, reviewer, settings, db)
