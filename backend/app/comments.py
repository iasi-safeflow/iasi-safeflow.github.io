"""Structured community updates and moderated comments on open public reports.

Quick tags (still_there / worse / looks_resolved) update counts right away when posted without text;
written comments pass the 112 gate and assistant flag detection, and stay held ('pending') until a
human reviewer approves them for public display.
"""

import json
import sqlite3

from .assistant.flags import detect_flags

COMMENT_TAGS = ("still_there", "worse", "looks_resolved")
MODERATION_FLAG_CODES = {"personal_data", "abusive", "possible_emergency"}


def detect_comment_flags(body: str) -> list[dict]:
    if not body:
        return []
    return [f for f in detect_flags({"description": body, "category": "alta"}) if f["code"] in MODERATION_FLAG_CODES]


def updates_summary(db: sqlite3.Connection, report_ids: list[int]) -> dict[int, dict[str, int]]:
    out = {rid: {tag: 0 for tag in COMMENT_TAGS} for rid in report_ids}
    if not report_ids:
        return out
    marks = ",".join("?" * len(report_ids))
    rows = db.execute(
        f"""SELECT report_id, tag, COUNT(*) AS cnt FROM report_comments
            WHERE report_id IN ({marks}) AND moderation_status = 'approved'
            GROUP BY report_id, tag""",
        report_ids,
    ).fetchall()
    for r in rows:
        out[r["report_id"]][r["tag"]] = int(r["cnt"])
    return out


def comment_counts(db: sqlite3.Connection, report_ids: list[int], status: str) -> dict[int, int]:
    if not report_ids:
        return {}
    marks = ",".join("?" * len(report_ids))
    rows = db.execute(
        f"""SELECT report_id, COUNT(*) AS cnt FROM report_comments
            WHERE report_id IN ({marks}) AND moderation_status = ? AND body != ''
            GROUP BY report_id""",
        [*report_ids, status],
    ).fetchall()
    return {r["report_id"]: int(r["cnt"]) for r in rows}


def public_comment_out(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "tag": row["tag"],
        "body": row["body"],
        "is_simulated": bool(row["is_simulated"]),
        "created_at": row["created_at"],
    }


def review_comment_out(row: sqlite3.Row, author_ref: str) -> dict:
    return {
        "id": row["id"],
        "tag": row["tag"],
        "body": row["body"],
        "moderation_status": row["moderation_status"],
        "flags": json.loads(row["flags_json"]),
        "author_ref": author_ref,
        "is_simulated": bool(row["is_simulated"]),
        "created_at": row["created_at"],
        "reviewed_at": row["reviewed_at"],
    }
