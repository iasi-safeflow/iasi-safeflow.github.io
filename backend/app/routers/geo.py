"""Street names and map search via OpenStreetMap Nominatim (app/geocoding.py).

/reverse is signed-in users only; /search is also open to the public map, with per-user or per-IP rate limiting
on top of the service-wide 1 request/second limit and cache, so this is never an open geocoding proxy.
"""

import sqlite3

from fastapi import APIRouter, Depends, Query, Request

from ..deps import current_user, get_db, optional_user
from ..errors import api_error
from ..geocoding import ATTRIBUTION, Geocoder, in_iasi
from ..rate_limit import check_rate_limit, client_ip

router = APIRouter(prefix="/geo", tags=["geo"])

USER_LIMIT = 30  # lookups per user or IP per window
USER_WINDOW_S = 10 * 60
_RATE_MSG = "Prea multe căutări de stradă. Încercați din nou peste câteva minute."


def get_geocoder(request: Request) -> Geocoder:
    return request.app.state.geocoder


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
    check_rate_limit(request.app.state.geo_usage, f"user:{user['id']}", USER_LIMIT, USER_WINDOW_S, _RATE_MSG)
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
    key = f"user:{user['id']}" if user is not None else f"ip:{client_ip(request)}"
    check_rate_limit(request.app.state.geo_usage, key, USER_LIMIT, USER_WINDOW_S, _RATE_MSG)
    results = geocoder.search(db, q)
    return {"available": results is not None, "results": results or [], "attribution": ATTRIBUTION}
