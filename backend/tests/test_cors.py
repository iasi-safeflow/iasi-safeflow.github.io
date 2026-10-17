"""CORS: only the configured exact origins get CORS headers; wildcards are refused."""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.config import parse_allowed_origins
from app.main import create_app

PAGES = "https://example-user.github.io"


@pytest.fixture
def cors_client(settings) -> TestClient:
    return TestClient(create_app(replace(settings, allowed_origins=(PAGES,))))


def test_allowed_origin_gets_cors_headers(cors_client):
    r = cors_client.get("/health", headers={"Origin": PAGES})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == PAGES
    assert "access-control-allow-credentials" not in r.headers


def test_preflight_from_allowed_origin(cors_client):
    r = cors_client.options(
        "/reports",
        headers={
            "Origin": PAGES,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == PAGES


@pytest.mark.parametrize("origin", ["https://evil.example", "https://example-user.github.io.evil.example", "null"])
def test_other_origins_get_no_cors_headers(cors_client, origin):
    r = cors_client.get("/health", headers={"Origin": origin})
    assert "access-control-allow-origin" not in r.headers
    pre = cors_client.options(
        "/reports", headers={"Origin": origin, "Access-Control-Request-Method": "POST"}
    )
    assert pre.status_code == 400
    assert "access-control-allow-origin" not in pre.headers


def test_no_origins_configured_means_no_cors(client):
    r = client.get("/health", headers={"Origin": PAGES})
    assert "access-control-allow-origin" not in r.headers


def test_parse_allowed_origins_trims_and_strips_trailing_slash():
    assert parse_allowed_origins(f" {PAGES}/ , http://localhost:8081 ") == (PAGES, "http://localhost:8081")
    assert parse_allowed_origins("") == ()
    assert parse_allowed_origins(None) == ()


@pytest.mark.parametrize("raw", ["*", f"{PAGES},*", "https://*.github.io"])
def test_wildcard_origin_is_refused(raw):
    with pytest.raises(ValueError):
        parse_allowed_origins(raw)


@pytest.mark.parametrize("raw", ["example-user.github.io", f"{PAGES}/iasi-safeflow"])
def test_origin_must_be_scheme_host_without_path(raw):
    with pytest.raises(ValueError):
        parse_allowed_origins(raw)


def test_create_app_refuses_wildcard_even_if_settings_built_directly(settings):
    with pytest.raises(ValueError):
        create_app(replace(settings, allowed_origins=("*",)))
