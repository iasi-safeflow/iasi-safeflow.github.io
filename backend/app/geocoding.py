"""Street names from OpenStreetMap Nominatim, only ever called from this backend.

Follows the Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/):
- at most 1 request per second in total: one limiter for the whole process, shared by every user and the
  background worker;
- every answer is cached (geocode_cache), so the same place is not asked for twice;
- only single points the app needs (a reporter's position, a public report's approximate area) and explicit
  searches after the user presses "Caută": no search-as-you-type, no grids, no periodic sweeps;
- an identifying User-Agent; the provider URL is a setting, so the service can be switched without an app update;
- coordinates are rounded before they leave the server, and nothing about the user is sent.
Results carry the ODbL attribution "© OpenStreetMap contributors". Any failure returns None: callers fall back to
distance and direction, and reporting never waits on this service.
"""

import json
import logging
import queue
import sqlite3
import threading
import time
from collections.abc import Callable
from datetime import datetime, timedelta

import httpx

from .config import Settings
from .db import connect, iso, utcnow
from .domain import IASI_BOUNDS, PUBLIC_COORD_DECIMALS

log = logging.getLogger("safeflow")

ATTRIBUTION = "© contribuitorii OpenStreetMap"
# Precision of a reporter's position sent for a street name (~10 m); public areas use PUBLIC_COORD_DECIMALS.
REVERSE_DECIMALS = 4
_STREET_KEYS = ("road", "pedestrian", "footway", "cycleway", "path", "square", "living_street", "service")


class RateLimiter:
    """Hands out at most one slot per `interval` seconds, across threads."""

    def __init__(self, interval: float = 1.0, clock: Callable[[], float] = time.monotonic, sleep=time.sleep):
        self.interval = interval
        self.clock = clock
        self.sleep = sleep
        self._next = 0.0
        self._lock = threading.Lock()

    def acquire(self, wait: float) -> bool:
        """Take the next slot if it comes within `wait` seconds (sleeping until then); otherwise give up."""
        with self._lock:
            now = self.clock()
            start = max(now, self._next)
            if start - now > wait:
                return False
            self._next = start + self.interval
        if start > now:
            self.sleep(start - now)
        return True


def in_iasi(lat: float, lon: float) -> bool:
    b = IASI_BOUNDS
    return b["lat_min"] <= lat <= b["lat_max"] and b["lon_min"] <= lon <= b["lon_max"]


def reverse_key(lat: float, lon: float, decimals: int) -> str:
    return f"rev:{lat:.{decimals}f},{lon:.{decimals}f}"


def _street(address: dict) -> str | None:
    for k in _STREET_KEYS:
        if address.get(k):
            return address[k]
    return None


def _label(item: dict) -> str:
    a = item.get("address") or {}
    street = _street(a)
    parts = [f"{street} {a['house_number']}" if street and a.get("house_number") else street]
    parts.append(a.get("suburb") or a.get("city_district") or a.get("neighbourhood"))
    parts = [p for p in parts if p]
    return ", ".join(parts) if parts else ", ".join(item.get("display_name", "").split(", ")[:2])


class Geocoder:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None, limiter: RateLimiter | None = None):
        self.enabled = settings.geocoder_enabled
        self.cache_ttl = timedelta(days=settings.geocoder_cache_days)
        self.limiter = limiter or RateLimiter(1.0)
        self.client = httpx.Client(
            base_url=settings.geocoder_url,
            timeout=3.0,
            headers={"User-Agent": settings.geocoder_user_agent},
            transport=transport,
        )

    # ---- cache ----
    def _cached(self, db: sqlite3.Connection, key: str) -> tuple[bool, object]:
        row = db.execute("SELECT value_json, fetched_at FROM geocode_cache WHERE key = ?", (key,)).fetchone()
        if row is None or utcnow() - datetime.fromisoformat(row["fetched_at"]) > self.cache_ttl:
            return False, None
        return True, json.loads(row["value_json"])

    def cached_value(self, db: sqlite3.Connection, key: str):
        return self._cached(db, key)[1]

    def is_cached(self, db: sqlite3.Connection, key: str) -> bool:
        return self._cached(db, key)[0]

    def _store(self, db: sqlite3.Connection, key: str, value) -> None:
        with db:
            db.execute(
                "INSERT OR REPLACE INTO geocode_cache (key, value_json, fetched_at) VALUES (?, ?, ?)",
                (key, json.dumps(value, ensure_ascii=False), iso(utcnow())),
            )

    def _get(self, path: str, params: dict, wait: float):
        """One request to the provider, or None when disabled, rate-limited or failing (never cached then)."""
        if not self.enabled or not self.limiter.acquire(wait):
            return None
        try:
            res = self.client.get(path, params={**params, "format": "jsonv2", "accept-language": "ro"})
            res.raise_for_status()
            return res.json()
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("Geocoding request failed (%s); falling back to distance and direction.", exc)
            return None

    # ---- lookups ----
    def reverse(self, db: sqlite3.Connection, lat: float, lon: float, decimals: int = REVERSE_DECIMALS, wait: float = 2.5):
        """{"street": str | None} for a point, or None when the service can't answer now."""
        key = reverse_key(lat, lon, decimals)
        hit, value = self._cached(db, key)
        if hit:
            return value
        data = self._get("/reverse", {"lat": f"{lat:.{decimals}f}", "lon": f"{lon:.{decimals}f}", "zoom": 17, "addressdetails": 1}, wait)
        if data is None:
            return None
        value = {"street": _street(data.get("address") or {}) if isinstance(data, dict) else None}
        self._store(db, key, value)
        return value

    def search(self, db: sqlite3.Connection, query: str, wait: float = 2.5):
        """Up to 5 places in Iași matching an explicit search, or None when the service can't answer now."""
        q = " ".join(query.split()).lower()
        key = f"search:{q}"
        hit, value = self._cached(db, key)
        if hit:
            return value
        b = IASI_BOUNDS
        data = self._get(
            "/search",
            {
                "q": q,
                "limit": 5,
                "countrycodes": "ro",
                "viewbox": f"{b['lon_min']},{b['lat_max']},{b['lon_max']},{b['lat_min']}",
                "bounded": 1,
                "addressdetails": 1,
            },
            wait,
        )
        if data is None:
            return None
        results = []
        for item in data if isinstance(data, list) else []:
            try:
                lat, lon = float(item["lat"]), float(item["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if in_iasi(lat, lon):
                results.append({"label": _label(item), "lat": round(lat, 6), "lon": round(lon, 6)})
        self._store(db, key, results)
        return results


class AreaStreetWorker:
    """Looks up the street of each public report's approximate area, one at a time and never faster than the
    shared limiter allows. Requests from people waiting in the app go first: this worker only takes free slots."""

    def __init__(self, geocoder: Geocoder, database_path: str):
        self.geocoder = geocoder
        self.database_path = database_path
        self.pending: queue.Queue[tuple[float, float]] = queue.Queue()
        self._thread: threading.Thread | None = None

    def enqueue(self, lat: float, lon: float) -> None:
        if not self.geocoder.enabled:
            return
        self.pending.put((round(lat, PUBLIC_COORD_DECIMALS), round(lon, PUBLIC_COORD_DECIMALS)))

    def enqueue_public_reports(self, db: sqlite3.Connection) -> None:
        for r in db.execute("SELECT lat, lon FROM reports WHERE public_visibility = 'public' AND status != 'rejected'"):
            self.enqueue(r["lat"], r["lon"])

    def process_one(self, db: sqlite3.Connection, wait: float = 0.0) -> bool:
        """Handle one queued area. False when the queue is empty or no slot was free (the area is queued again)."""
        try:
            lat, lon = self.pending.get_nowait()
        except queue.Empty:
            return False
        key = reverse_key(lat, lon, PUBLIC_COORD_DECIMALS)
        if self.geocoder.is_cached(db, key):
            return True
        if self.geocoder.reverse(db, lat, lon, decimals=PUBLIC_COORD_DECIMALS, wait=wait) is None:
            self.pending.put((lat, lon))
            return False
        return True

    def start(self) -> None:
        if not self.geocoder.enabled or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, name="area-street-worker", daemon=True)
        self._thread.start()

    def _run(self) -> None:
        conn = connect(self.database_path)
        while True:
            try:
                if not self.process_one(conn):
                    time.sleep(2.0)  # nothing to do, or the slot went to a user: try again later
            except Exception:
                log.exception("Area street lookup failed; it will be retried.")
                time.sleep(10.0)


def area_street(geocoder: Geocoder | None, db: sqlite3.Connection, lat: float, lon: float) -> str | None:
    """The cached street of a public report's approximate area (no network call)."""
    if geocoder is None:
        return None
    value = geocoder.cached_value(db, reverse_key(round(lat, PUBLIC_COORD_DECIMALS), round(lon, PUBLIC_COORD_DECIMALS), PUBLIC_COORD_DECIMALS))
    return value.get("street") if isinstance(value, dict) else None
