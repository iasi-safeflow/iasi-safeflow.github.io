"""Street names: the Nominatim adapter (rate limit, cache, rounding, fallback) and the /geo endpoints."""

from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.db import connect, init_db
from app.geocoding import ATTRIBUTION, AreaStreetWorker, Geocoder, RateLimiter
from app.main import create_app
from conftest import auth_header, valid_report

LAT, LON = 47.162345, 27.588712


class FakeClock:
    def __init__(self):
        self.now = 1000.0
        self.slept = []

    def __call__(self):
        return self.now

    def sleep(self, s):
        self.slept.append(s)
        self.now += s


class FakeNominatim:
    """Records requests and answers like Nominatim (or fails, when told to)."""

    def __init__(self):
        self.requests: list[httpx.Request] = []
        self.fail = False

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.fail:
            return httpx.Response(503)
        if request.url.path == "/reverse":
            return httpx.Response(200, json={"address": {"road": "Strada Lăpușneanu", "city": "Iași"}})
        return httpx.Response(200, json=[
            {"lat": "47.1650", "lon": "27.5840", "address": {"road": "Strada Lăpușneanu", "house_number": "12", "suburb": "Centru"}},
            {"lat": "44.4300", "lon": "26.1000", "address": {"road": "Strada Lăpușneanu", "city": "București"}},  # outside
        ])


@pytest.fixture
def fake():
    return FakeNominatim()


@pytest.fixture
def clock():
    return FakeClock()


@pytest.fixture
def geocoder(settings, fake, clock):
    s = replace(settings, geocoder_enabled=True, geocoder_url="https://geo.test")
    return Geocoder(s, transport=httpx.MockTransport(fake), limiter=RateLimiter(1.0, clock=clock, sleep=clock.sleep))


@pytest.fixture
def db(settings):
    conn = connect(settings.database_path)
    init_db(conn)
    yield conn
    conn.close()


def test_rate_limiter_allows_one_request_per_second(clock):
    limiter = RateLimiter(1.0, clock=clock, sleep=clock.sleep)
    assert limiter.acquire(wait=0)
    assert not limiter.acquire(wait=0)  # the next slot is a second away
    assert limiter.acquire(wait=2)  # waits for it…
    assert clock.slept == [1.0]  # …by sleeping exactly until then
    clock.now += 5
    assert limiter.acquire(wait=0)


def test_reverse_rounds_identifies_and_caches(geocoder, fake, db):
    assert geocoder.reverse(db, LAT, LON) == {"street": "Strada Lăpușneanu"}
    assert geocoder.reverse(db, LAT - 0.00002, LON) == {"street": "Strada Lăpușneanu"}  # same ~10 m cell (47.1623)
    assert len(fake.requests) == 1  # second answer came from the cache
    req = fake.requests[0]
    assert req.url.params["lat"] == "47.1623" and req.url.params["lon"] == "27.5887"  # rounded before leaving
    assert req.url.params["format"] == "jsonv2" and req.url.params["accept-language"] == "ro"
    assert req.headers["user-agent"].startswith("IasiSafeFlow/")
    assert "authorization" not in req.headers and "cookie" not in req.headers


def test_failure_falls_back_and_is_not_cached(geocoder, fake, clock, db):
    fake.fail = True
    assert geocoder.reverse(db, LAT, LON) is None
    clock.now += 2
    fake.fail = False
    assert geocoder.reverse(db, LAT, LON) == {"street": "Strada Lăpușneanu"}  # retried later, then cached
    assert len(fake.requests) == 2


def test_rate_limited_lookup_falls_back_without_a_request(geocoder, fake, db):
    assert geocoder.reverse(db, LAT, LON, wait=0) is not None
    assert geocoder.reverse(db, 47.17, 27.57, wait=0) is None  # another place within the same second
    assert len(fake.requests) == 1


def test_network_error_falls_back(settings, db, clock):
    def broken(request):
        raise httpx.ConnectError("no route")

    s = replace(settings, geocoder_enabled=True, geocoder_url="https://geo.test")
    g = Geocoder(s, transport=httpx.MockTransport(broken), limiter=RateLimiter(1.0, clock=clock, sleep=clock.sleep))
    assert g.reverse(db, LAT, LON) is None


def test_disabled_geocoder_never_calls_out(settings, fake, db):
    g = Geocoder(settings, transport=httpx.MockTransport(fake))  # geocoder_enabled is False in tests
    assert g.reverse(db, LAT, LON) is None and g.search(db, "Lăpușneanu") is None
    assert fake.requests == []


def test_search_is_bounded_to_iasi_and_cached(geocoder, fake, db):
    results = geocoder.search(db, "  Lăpușneanu   12 ")
    assert results == [{"label": "Strada Lăpușneanu 12, Centru", "lat": 47.165, "lon": 27.584}]  # București dropped
    params = fake.requests[0].url.params
    assert params["q"] == "lăpușneanu 12" and params["bounded"] == "1" and params["countrycodes"] == "ro"
    assert params["viewbox"] == "27.45,47.24,27.72,47.08"
    geocoder.search(db, "lăpușneanu 12")
    assert len(fake.requests) == 1


def test_area_worker_fills_public_street_names(geocoder, fake, db):
    worker = AreaStreetWorker(geocoder, ":memory:")
    worker.enqueue(LAT, LON)
    worker.enqueue(LAT + 0.0001, LON)  # same ~100 m public cell
    assert worker.process_one(db, wait=5) and worker.process_one(db, wait=5)
    assert len(fake.requests) == 1 and fake.requests[0].url.params["lat"] == "47.162"
    assert not worker.process_one(db)  # queue empty


# ---- endpoints ----

@pytest.fixture
def geo_client(settings, geocoder):
    return TestClient(create_app(settings, geocoder=geocoder))


def _token(client):
    r = client.post("/auth/register", json={"email": "ana@example.com", "password": "parola-sigura"})
    return r.json()["token"]


def test_endpoints_require_login(geo_client):
    assert geo_client.get(f"/geo/reverse?lat={LAT}&lon={LON}").status_code == 401
    assert geo_client.get("/geo/search?q=Copou").status_code == 401


def test_reverse_endpoint(geo_client, fake):
    h = auth_header(_token(geo_client))
    r = geo_client.get(f"/geo/reverse?lat={LAT}&lon={LON}", headers=h)
    assert r.json() == {"available": True, "street": "Strada Lăpușneanu", "attribution": ATTRIBUTION}
    assert geo_client.get("/geo/reverse?lat=44.43&lon=26.10", headers=h).status_code == 422  # outside Iași
    fake.fail = True
    r = geo_client.get("/geo/reverse?lat=47.17&lon=27.57", headers=h)
    assert r.status_code == 200 and r.json()["available"] is False and r.json()["street"] is None


def test_search_endpoint_validation_and_user_limit(geo_client):
    h = auth_header(_token(geo_client))
    assert geo_client.get("/geo/search?q=ab", headers=h).status_code == 422  # explicit searches of 3+ characters
    assert geo_client.get("/geo/search?q=Copou", headers=h).json()["available"] is True
    codes = [geo_client.get("/geo/search?q=Copou", headers=h).status_code for _ in range(40)]
    assert 429 in codes  # per-user limit on top of the service-wide one


def test_report_submission_never_waits_for_street_names(settings, fake, clock):
    fake.fail = True
    s = replace(settings, geocoder_enabled=True, geocoder_url="https://geo.test")
    g = Geocoder(s, transport=httpx.MockTransport(fake), limiter=RateLimiter(1.0, clock=clock, sleep=clock.sleep))
    app = create_app(s, geocoder=g)
    app.state.area_streets.start = lambda: None  # keep the worker thread out of this test
    client = TestClient(app)
    r = client.post("/reports", json=valid_report(), headers=auth_header(_token(client)))
    assert r.status_code == 201
    assert client.get("/public/reports").json()[0]["area_street"] is None  # not looked up yet: list still works
