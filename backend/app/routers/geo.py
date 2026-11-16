"""Street names and map search via OpenStreetMap Nominatim (app/geocoding.py).

/reverse is signed-in users only; /search is also open to the public map, with per-user or per-IP rate limiting
on top of the service-wide 1 request/second limit and cache, so this is never an open geocoding proxy.
"""

import sqlite3
import time
from collections import deque

from fastapi import APIRouter, Depends, Query, Request

from ..deps import current_user, get_db, optional_user
from ..errors import api_error
from ..geocoding import ATTRIBUTION, Geocoder, in_iasi

router = APIRouter(prefix="/geo", tags=["geo"])

USER_LIMIT = 30  # lookups per user or IP per window
USER_WINDOW_S = 10 * 60


def get_geocoder(request: Request) -> Geocoder:
    return request.app.state.geocoder


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _rate_limit(request: Request, key: str) -> None:
    seen: dict[str, deque] = request.app.state.geo_usage
    now = time.monotonic()
    q = seen.setdefault(key, deque())
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
    _rate_limit(request, f"user:{user['id']}")
    value = geocoder.reverse(db, lat, lon)
    return {"available": value is not None, "street": (value or {}).get("street"), "attribution": ATTRIBUTION}


@router.get("/search")
def search(
    request: Request,
    q: str = Query(..., min_length=3, max_length=100),
    user: sqlite3.Row | None = Depends(optional_user),
    geocoder: Geocoder = Depends(get_geocoder),
    db: sqlite3.Connection = Depends(get_db),
):
    key = f"user:{user['id']}" if user is not None else f"ip:{_client_ip(request)}"
    _rate_limit(request, key)
    results = geocoder.search(db, q)
    return {"available": results is not None, "results": results or [], "attribution": ATTRIBUTION}
