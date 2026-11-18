"""Civic points, trusted confirmation weight (2x), and priority boosts ("Susține sesizarea").

Anti-spam rule: points are earned ONLY when a human reviewer validates or acts on a report
(never on raw submission, and never on rejected reports). Spending points to boost a hazard
never reduces lifetime earned points, so Trusted Contributor status (2x weight) is kept.
"""

import sqlite3

from .assistant import config as assistant_config
from .assistant.similarity import normalize_text
from .errors import api_error

PTS_REPORT_VALIDATED = 15
PTS_DETAIL_BONUS = 5
PTS_PHOTO_BONUS = 5
PTS_CONFIRM_VALIDATED = 5
PTS_COMMENT_APPROVED = 5
PTS_IMPACT = 25
BOOST_COST = 50
TRUSTED_THRESHOLD = 100


def _level_name(earned: int) -> str:
    if earned >= 250:
        return "Ambasador SafeFlow"
    if earned >= TRUSTED_THRESHOLD:
        return "Contributor de încredere (2×)"
    if earned >= 40:
        return "Sprijin comunitar"
    return "Observator"


def user_points(db: sqlite3.Connection, user_id: int) -> dict:
    row = db.execute(
        """SELECT COALESCE(SUM(delta), 0) AS balance,
                  COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) AS earned
           FROM point_events WHERE user_id = ?""",
        (user_id,),
    ).fetchone()
    balance, earned = int(row["balance"]), int(row["earned"])
    trusted = earned >= TRUSTED_THRESHOLD
    return {
        "balance": balance,
        "earned": earned,
        "trusted": trusted,
        "trusted_threshold": TRUSTED_THRESHOLD,
        "boost_cost": BOOST_COST,
        "weight": 2 if trusted else 1,
        "level": _level_name(earned),
    }


def user_points_history(db: sqlite3.Connection, user_id: int, limit: int = 30) -> list[dict]:
    rows = db.execute(
        """SELECT pe.id, pe.kind, pe.delta, pe.description, pe.created_at, r.public_id AS report_id
           FROM point_events pe LEFT JOIN reports r ON r.id = pe.report_id
           WHERE pe.user_id = ? ORDER BY pe.id DESC LIMIT ?""",
        (user_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def _grant(
    db: sqlite3.Connection,
    user_id: int,
    report_id: int,
    kind: str,
    delta: int,
    description: str,
    now_iso: str,
) -> None:
    db.execute(
        """INSERT OR IGNORE INTO point_events (user_id, report_id, kind, delta, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (user_id, report_id, kind, delta, description, now_iso),
    )


def _has_complete_description(description: str) -> bool:
    norm = normalize_text(description)
    return len(norm) >= assistant_config.DESCRIPTION_MIN_CHARS and len(norm.split()) >= assistant_config.DESCRIPTION_MIN_WORDS


def award_for_status(db: sqlite3.Connection, report: sqlite3.Row, to_status: str, now_iso: str) -> None:
    """Grant verified civic points inside the reviewer's status-change transaction (idempotent per milestone)."""
    if bool(report["is_simulated"]):
        return
    report_id = report["id"]
    reporter_id = report["reporter_id"]
    public_id = report["public_id"]

    confirmers = [
        r["user_id"]
        for r in db.execute(
            "SELECT DISTINCT user_id FROM report_confirmations WHERE report_id = ? AND user_id IS NOT NULL",
            (report_id,),
        ).fetchall()
        if r["user_id"] != reporter_id
    ]

    if to_status == "validated":
        _grant(db, reporter_id, report_id, "report_validated", PTS_REPORT_VALIDATED, f"Raport validat ({public_id})", now_iso)
        if _has_complete_description(report["description"]):
            _grant(
                db,
                reporter_id,
                report_id,
                "report_detail_bonus",
                PTS_DETAIL_BONUS,
                f"Bonus descriere detaliată ({public_id})",
                now_iso,
            )
        has_photo = db.execute("SELECT 1 FROM report_photos WHERE report_id = ? LIMIT 1", (report_id,)).fetchone() is not None
        if has_photo:
            _grant(
                db,
                reporter_id,
                report_id,
                "report_photo_bonus",
                PTS_PHOTO_BONUS,
                f"Bonus dovadă foto validată ({public_id})",
                now_iso,
            )
        for uid in confirmers:
            _grant(
                db,
                uid,
                report_id,
                "confirm_validated",
                PTS_CONFIRM_VALIDATED,
                f"Confirmare validată ({public_id})",
                now_iso,
            )
    elif to_status in ("referred", "resolved"):
        _grant(
            db,
            reporter_id,
            report_id,
            "report_impact",
            PTS_IMPACT,
            f"Impact civic: raport pregătit/rezolvat ({public_id})",
            now_iso,
        )
        for uid in confirmers:
            _grant(
                db,
                uid,
                report_id,
                "confirm_impact",
                PTS_IMPACT,
                f"Impact civic la raport confirmat ({public_id})",
                now_iso,
            )


def award_for_comment(db: sqlite3.Connection, comment: sqlite3.Row, public_id: str, now_iso: str) -> None:
    """Award +5 pts once per report when a signed-in user's written comment is approved by a reviewer."""
    if bool(comment["is_simulated"]) or comment["user_id"] is None or not comment["body"]:
        return
    _grant(
        db,
        comment["user_id"],
        comment["report_id"],
        "comment_approved",
        PTS_COMMENT_APPROVED,
        f"Comentariu aprobat ({public_id})",
        now_iso,
    )


def boost_counts(db: sqlite3.Connection, report_ids: list[int]) -> dict[int, int]:
    if not report_ids:
        return {}
    marks = ",".join("?" * len(report_ids))
    rows = db.execute(
        f"SELECT report_id, COUNT(*) AS cnt FROM report_boosts WHERE report_id IN ({marks}) GROUP BY report_id",
        report_ids,
    ).fetchall()
    return {r["report_id"]: r["cnt"] for r in rows}


def boosted_by_user(db: sqlite3.Connection, report_ids: list[int], user_id: int | None) -> set[int]:
    if not report_ids or user_id is None:
        return set()
    marks = ",".join("?" * len(report_ids))
    rows = db.execute(
        f"SELECT report_id FROM report_boosts WHERE user_id = ? AND report_id IN ({marks})",
        [user_id, *report_ids],
    ).fetchall()
    return {r["report_id"] for r in rows}


def spend_boost(db: sqlite3.Connection, report: sqlite3.Row, user_id: int, now_iso: str) -> tuple[int, int]:
    """Spend BOOST_COST points to prioritize an open public report. Returns (new_boosts_count, new_balance)."""
    if db.execute(
        "SELECT 1 FROM report_boosts WHERE report_id = ? AND user_id = ?", (report["id"], user_id)
    ).fetchone():
        raise api_error(409, "already_boosted", "Ați susținut deja prioritar acest raport.")
    summary = user_points(db, user_id)
    if summary["balance"] < BOOST_COST:
        raise api_error(
            409,
            "insufficient_points",
            f"Aveți nevoie de cel puțin {BOOST_COST} de puncte validate pentru a susține prioritar un raport.",
        )
    with db:
        db.execute(
            "INSERT INTO report_boosts (report_id, user_id, cost, created_at) VALUES (?, ?, ?, ?)",
            (report["id"], user_id, BOOST_COST, now_iso),
        )
        db.execute(
            """INSERT INTO point_events (user_id, report_id, kind, delta, description, created_at)
               VALUES (?, ?, 'boost_spent', ?, ?, ?)""",
            (user_id, report["id"], -BOOST_COST, f"Susținere prioritară ({report['public_id']})", now_iso),
        )
    cnt = db.execute("SELECT COUNT(*) FROM report_boosts WHERE report_id = ?", (report["id"],)).fetchone()[0]
    new_balance = user_points(db, user_id)["balance"]
    return int(cnt), new_balance
