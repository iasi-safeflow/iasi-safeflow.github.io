"""Public, unauthenticated endpoints. Only privacy-safe fields: no description, reporter, exact time or exact location.

Held reports (public_visibility = 'held') never appear here, not even by ID, until a reviewer publishes them.
"""

import hashlib
import re
import sqlite3
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, Query, Request

from ..clusters import CLUSTER_WINDOW_DAYS, build_clusters
from ..db import iso, utcnow
from ..deps import current_user, get_db, optional_user
from ..domain import PUBLIC_COORD_DECIMALS, PUBLIC_HIDDEN_STATUSES, verification
from ..errors import api_error
from ..geocoding import area_street
from ..points import boost_counts, boosted_by_user, spend_boost, user_points
from ..rate_limit import check_rate_limit, client_ip

router = APIRouter(prefix="/public", tags=["public"])

_HIDDEN = ",".join("?" * len(PUBLIC_HIDDEN_STATUSES))
_CLOSED_FOR_CONFIRM = ("rejected", "resolved", "expired")
_DEVICE_RE = re.compile(r"^[A-Za-z0-9._-]{8,128}$")
CONFIRM_LIMIT = 30
CONFIRM_WINDOW_S = 10 * 60
_CONFIRM_RATE_MSG = "Prea multe confirmări într-un timp scurt. Încercați din nou peste câteva minute."


def confirmation_counts(db: sqlite3.Connection, report_ids: list[int]) -> dict[int, int]:
    if not report_ids:
        return {}
    marks = ",".join("?" * len(report_ids))
    rows = db.execute(
        f"SELECT report_id, COUNT(*) AS cnt FROM report_confirmations WHERE report_id IN ({marks}) GROUP BY report_id",
        report_ids,
    ).fetchall()
    return {r["report_id"]: r["cnt"] for r in rows}


def _device_actor_key(raw: str | None) -> str | None:
    if not raw or not _DEVICE_RE.match(raw):
        return None
    return "device:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _caller_keys(user: sqlite3.Row | None, device_id: str | None) -> list[str]:
    keys = []
    if user is not None:
        keys.append(f"user:{user['id']}")
    dev = _device_actor_key(device_id)
    if dev:
        keys.append(dev)
    return keys


def _confirmed_ids(db: sqlite3.Connection, report_ids: list[int], keys: list[str]) -> set[int]:
    if not report_ids or not keys:
        return set()
    r_marks = ",".join("?" * len(report_ids))
    k_marks = ",".join("?" * len(keys))
    rows = db.execute(
        f"SELECT DISTINCT report_id FROM report_confirmations WHERE report_id IN ({r_marks}) AND actor_key IN ({k_marks})",
        [*report_ids, *keys],
    ).fetchall()
    return {r["report_id"] for r in rows}


def public_report_out(
    row: sqlite3.Row,
    street: str | None = None,
    confirmations_count: int = 0,
    confirmed_by_me: bool = False,
    boosts_count: int = 0,
    boosted_by_me: bool = False,
) -> dict:
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
        "verification": verification(row["status"]),
        # Street near the approximate (~100 m) location, from OpenStreetMap; null until looked up.
        "area_street": street,
        "confirmations_count": confirmations_count,
        "confirmed_by_me": confirmed_by_me,
        "boosts_count": boosts_count,
        "boosted_by_me": boosted_by_me,
    }


@router.get("/reports")
def public_reports(
    request: Request,
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    x_device_id: str | None = Header(default=None),
    user: sqlite3.Row | None = Depends(optional_user),
    db: sqlite3.Connection = Depends(get_db),
):
    sql = f"SELECT * FROM reports WHERE public_visibility = 'public' AND status NOT IN ({_HIDDEN})"
    params: list = list(PUBLIC_HIDDEN_STATUSES)
    if category:
        sql += " AND category = ?"
        params.append(category)
    if status:
        sql += " AND status = ?"
        params.append(status)
    sql += " ORDER BY observed_at DESC LIMIT 1000"
    geocoder = request.app.state.geocoder
    rows = db.execute(sql, params).fetchall()
    ids = [r["id"] for r in rows]
    counts = confirmation_counts(db, ids)
    mine = _confirmed_ids(db, ids, _caller_keys(user, x_device_id))
    boosts = boost_counts(db, ids)
    my_boosts = boosted_by_user(db, ids, user["id"] if user is not None else None)
    return [
        public_report_out(
            r,
            area_street(geocoder, db, r["lat"], r["lon"]),
            counts.get(r["id"], 0),
            r["id"] in mine,
            boosts.get(r["id"], 0),
            r["id"] in my_boosts,
        )
        for r in rows
    ]


@router.get("/reports/{public_id}")
def public_report_status(
    public_id: str,
    request: Request,
    x_device_id: str | None = Header(default=None),
    user: sqlite3.Row | None = Depends(optional_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Status lookup by report ID (works for rejected reports too, so reporters see the outcome)."""
    row = db.execute(
        "SELECT * FROM reports WHERE public_id = ? AND public_visibility = 'public'", (public_id.upper(),)
    ).fetchone()
    if row is None:
        raise api_error(404, "not_found", "Raportul nu a fost găsit.")
    geocoder = request.app.state.geocoder
    counts = confirmation_counts(db, [row["id"]])
    mine = _confirmed_ids(db, [row["id"]], _caller_keys(user, x_device_id))
    boosts = boost_counts(db, [row["id"]])
    my_boosts = boosted_by_user(db, [row["id"]], user["id"] if user is not None else None)
    return public_report_out(
        row,
        area_street(geocoder, db, row["lat"], row["lon"]),
        counts.get(row["id"], 0),
        row["id"] in mine,
        boosts.get(row["id"], 0),
        row["id"] in my_boosts,
    )


@router.post("/reports/{public_id}/confirm")
def toggle_confirm(
    public_id: str,
    request: Request,
    x_device_id: str | None = Header(default=None),
    user: sqlite3.Row | None = Depends(optional_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """1-tap citizen confirmation ("Și eu am observat") on an open public report; tap again to undo."""
    keys = _caller_keys(user, x_device_id)
    if not keys:
        raise api_error(422, "missing_device_id", "Identificatorul dispozitivului lipsește sau este invalid.")

    check_rate_limit(request.app.state.confirm_usage, f"ip:{client_ip(request)}", CONFIRM_LIMIT, CONFIRM_WINDOW_S, _CONFIRM_RATE_MSG)
    check_rate_limit(request.app.state.confirm_usage, f"actor:{keys[0]}", CONFIRM_LIMIT, CONFIRM_WINDOW_S, _CONFIRM_RATE_MSG)

    row = db.execute(
        "SELECT * FROM reports WHERE public_id = ? AND public_visibility = 'public'", (public_id.upper(),)
    ).fetchone()
    if row is None or row["status"] == "rejected":
        raise api_error(404, "not_found", "Raportul nu a fost găsit.")
    if row["status"] in _CLOSED_FOR_CONFIRM:
        raise api_error(409, "report_closed", "Raportul este deja închis și nu mai poate fi confirmat.")
    if user is not None and row["reporter_id"] == user["id"]:
        raise api_error(409, "self_confirm", "Nu puteți confirma propriul raport.")

    marks = ",".join("?" * len(keys))
    existing = db.execute(
        f"SELECT id FROM report_confirmations WHERE report_id = ? AND actor_key IN ({marks})",
        [row["id"], *keys],
    ).fetchall()
    with db:
        if existing:
            e_marks = ",".join("?" * len(existing))
            db.execute(f"DELETE FROM report_confirmations WHERE id IN ({e_marks})", [e["id"] for e in existing])
            confirmed = False
        else:
            weight = user_points(db, user["id"])["weight"] if user is not None else 1
            db.execute(
                """INSERT INTO report_confirmations (report_id, actor_key, user_id, weight, is_simulated, created_at)
                   VALUES (?, ?, ?, ?, 0, ?)""",
                (row["id"], keys[0], user["id"] if user is not None else None, weight, iso(utcnow())),
            )
            confirmed = True

    total = db.execute("SELECT COUNT(*) FROM report_confirmations WHERE report_id = ?", (row["id"],)).fetchone()[0]
    return {"public_id": row["public_id"], "confirmations_count": total, "confirmed_by_me": confirmed}


@router.post("/reports/{public_id}/boost")
def boost_report(
    public_id: str,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Spend earned civic points to prioritize an open public report in the reviewer queue."""
    row = db.execute(
        "SELECT * FROM reports WHERE public_id = ? AND public_visibility = 'public'", (public_id.upper(),)
    ).fetchone()
    if row is None or row["status"] == "rejected":
        raise api_error(404, "not_found", "Raportul nu a fost găsit.")
    if row["status"] in _CLOSED_FOR_CONFIRM:
        raise api_error(409, "report_closed", "Raportul este deja închis și nu mai poate fi susținut prioritar.")
    boosts_count, new_balance = spend_boost(db, row, user["id"], iso(utcnow()))
    return {
        "public_id": row["public_id"],
        "boosts_count": boosts_count,
        "boosted_by_me": True,
        "points_balance": new_balance,
    }


@router.get("/clusters")
def public_clusters(
    request: Request,
    category: str | None = Query(default=None),
    days: int = Query(default=CLUSTER_WINDOW_DAYS, ge=1, le=365),
    db: sqlite3.Connection = Depends(get_db),
):
    """Hotspot clusters of nearby public observations within the time window (potential patterns only)."""
    since = iso(utcnow() - timedelta(days=days))
    sql = f"SELECT * FROM reports WHERE public_visibility = 'public' AND status NOT IN ({_HIDDEN}) AND observed_at >= ?"
    params: list = [*PUBLIC_HIDDEN_STATUSES, since]
    if category:
        sql += " AND category = ?"
        params.append(category)
    rows = [dict(r) for r in db.execute(sql, params).fetchall()]
    counts = confirmation_counts(db, [r["id"] for r in rows])
    geocoder = request.app.state.geocoder
    return build_clusters(rows, counts, street_for_row=lambda r: area_street(geocoder, db, r["lat"], r["lon"]))
