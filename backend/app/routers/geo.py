"""Street names for the screen-reader mode (app/geocoding.py). Signed-in users only, with a per-user limit on top
of the service-wide 1 request/second, so this is never an open geocoding proxy."""

import sqlite3
import time
from collections import deque

from fastapi import APIRouter, Depends, Query, Request

from ..deps import current_user, get_db
from ..errors import api_error
from ..geocoding import ATTRIBUTION, Geocoder, in_iasi

router = APIRouter(prefix="/geo", tags=["geo"])

USER_LIMIT = 30  # lookups per user per window
USER_WINDOW_S = 10 * 60


def get_geocoder(request: Request) -> Geocoder:
    return request.app.state.geocoder


def _per_user_limit(request: Request, user_id: int) -> None:
    seen: dict[int, deque] = request.app.state.geo_usage
    now = time.monotonic()
    q = seen.setdefault(user_id, deque())
    while q and now - q[0] > USER_WINDOW_S:
        q.popleft()
    if len(q) >= USER_LIMIT:
        raise api_error(429, "rate_limited", "Prea multe căutări de stradă. Încercați din nou peste câteva minute.")
    q.append(now)


@router.get("/reverse")
def reverse(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    user: sqlite3.Row = Depends(current_user),
    geocoder: Geocoder = Depends(get_geocoder),
    db: sqlite3.Connection = Depends(get_db),
):
    if not in_iasi(lat, lon):
        raise api_error(422, "outside_area", "Locația trebuie să fie în zona Iașiului.")
    _per_user_limit(request, user["id"])
    value = geocoder.reverse(db, lat, lon)
    return {"available": value is not None, "street": (value or {}).get("street"), "attribution": ATTRIBUTION}


@router.get("/search")
def search(
    request: Request,
    q: str = Query(..., min_length=3, max_length=100),
    user: sqlite3.Row = Depends(current_user),
    geocoder: Geocoder = Depends(get_geocoder),
    db: sqlite3.Connection = Depends(get_db),
):
    _per_user_limit(request, user["id"])
    results = geocoder.search(db, q)
    return {"available": results is not None, "results": results or [], "attribution": ATTRIBUTION}
