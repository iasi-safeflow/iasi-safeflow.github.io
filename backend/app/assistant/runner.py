"""Runs the review assistant and stores each result as a new, append-only row in assistant_runs.

The assistant only suggests: nothing here changes a report's status, merges or deletes anything, or notifies anyone.
The one effect of a result is decided by the caller when a report is created: a report with flags starts out held.
"""

import json
import sqlite3
from datetime import datetime, timedelta

from ..db import iso
from . import config
from .flags import detect_flags
from .priority import score_importance
from .similarity import find_duplicates, haversine_m


def pair_decisions(db: sqlite3.Connection, report_id: int | None) -> dict[int, sqlite3.Row]:
    """Latest reviewer decision for each report paired with `report_id`, keyed by the other report's id."""
    if report_id is None:
        return {}
    rows = db.execute(
        "SELECT * FROM report_relations WHERE report_id = ? OR related_report_id = ? ORDER BY id", (report_id, report_id)
    ).fetchall()
    return {(r["related_report_id"] if r["report_id"] == report_id else r["report_id"]): r for r in rows}


def _window_rows(db: sqlite3.Connection, observed_at: str) -> list[dict]:
    """Non-rejected reports observed within the duplicate window of `observed_at`, anywhere in the city."""
    centre = datetime.fromisoformat(observed_at)
    span = timedelta(days=config.DUPLICATE_WINDOW_DAYS)
    rows = db.execute(
        "SELECT * FROM reports WHERE status != 'rejected' AND observed_at BETWEEN ? AND ? ORDER BY id",
        (iso(centre - span), iso(centre + span)),
    ).fetchall()
    return [dict(r) for r in rows]


def assess(db: sqlite3.Connection, report: dict, now: datetime) -> dict:
    """Compute a result without writing anything. `report` may not be stored yet (then it has no id)."""
    report_id = report.get("id")
    window = [r for r in _window_rows(db, report["observed_at"]) if r["public_id"] != report["public_id"]]
    decisions = pair_decisions(db, report_id)
    # A pair a reviewer already ruled on is not suggested again.
    candidates = [r for r in window if r["id"] not in decisions or decisions[r["id"]]["relation_type"] == "duplicate_revoked"]
    duplicates = find_duplicates(report, candidates, corpus=window + [report])
    confirmed = sum(
        1 for d in decisions.values() if d["relation_type"] == "duplicate_confirmed" and d["related_report_id"] == report_id
    )
    return {
        "importance": score_importance(report, corroborations=len(duplicates) + confirmed, now=now),
        "duplicates": duplicates,
        "flags": detect_flags(report),
    }


def record(db: sqlite3.Connection, report_id: int, triggered_by: str, result: dict, now: datetime) -> int:
    """Append a result. Call inside the caller's transaction."""
    cur = db.execute(
        """INSERT INTO assistant_runs (report_id, triggered_by, assistant_version, created_at, importance_score,
               importance_level, factors_json, flags_json, duplicates_json, last_action_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(id), 0) FROM review_actions))""",
        (
            report_id, triggered_by, config.ASSISTANT_VERSION, iso(now),
            result["importance"]["score"], result["importance"]["level"],
            json.dumps(result["importance"]["factors"], ensure_ascii=False),
            json.dumps(result["flags"], ensure_ascii=False),
            json.dumps(result["duplicates"], ensure_ascii=False),
        ),
    )
    return cur.lastrowid


def recheck(db: sqlite3.Connection, report_id: int, triggered_by: str, now: datetime) -> None:
    row = db.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    with db:
        record(db, report_id, triggered_by, assess(db, dict(row), now), now)


def nearby_open_ids(db: sqlite3.Connection, report: dict) -> list[int]:
    """Open reports (other than `report`) within the duplicate radius and time window of `report`."""
    return [
        r["id"] for r in _window_rows(db, report["observed_at"])
        if r["id"] != report["id"]
        and r["status"] in config.OPEN_STATUSES
        and haversine_m(report["lat"], report["lon"], r["lat"], r["lon"]) <= config.DUPLICATE_RADIUS_M
    ]


def recheck_nearby(db: sqlite3.Connection, report: dict, now: datetime, triggered_by: str = "nearby_report") -> int:
    """A new or changed report can add or remove a duplicate or corroboration around it: re-check open reports there."""
    ids = nearby_open_ids(db, report)
    for report_id in ids:
        recheck(db, report_id, triggered_by, now)
    return len(ids)


def latest_runs(db: sqlite3.Connection, report_ids: list[int]) -> dict[int, sqlite3.Row]:
    if not report_ids:
        return {}
    marks = ",".join("?" * len(report_ids))
    rows = db.execute(
        f"""SELECT * FROM assistant_runs WHERE id IN
                (SELECT MAX(id) FROM assistant_runs WHERE report_id IN ({marks}) GROUP BY report_id)""",
        report_ids,
    ).fetchall()
    return {r["report_id"]: r for r in rows}


def run_out(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "triggered_by": row["triggered_by"],
        "assistant_version": row["assistant_version"],
        "created_at": row["created_at"],
        "importance": {
            "score": row["importance_score"],
            "level": row["importance_level"],
            "factors": json.loads(row["factors_json"]),
        },
        "flags": json.loads(row["flags_json"]),
        "duplicates": json.loads(row["duplicates_json"]),
    }
