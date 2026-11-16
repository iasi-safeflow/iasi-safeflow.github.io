"""App factory. Run with:  uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000"""

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, load_settings
from .db import connect, init_db
from .errors import request_validation_handler
from .geocoding import AreaStreetWorker, Geocoder
from .routers import auth, geo, public, reports, review
from .safety import EMERGENCY_MESSAGE_EN, EMERGENCY_MESSAGE_RO
from .seed import seed_demo_reports


def create_app(settings: Settings | None = None, geocoder: Geocoder | None = None) -> FastAPI:
    settings = settings or load_settings()
    app = FastAPI(title="Iași SafeFlow API", version="0.1.0")
    app.state.settings = settings
    app.state.login_failures = {}
    app.state.geo_usage = {}
    app.state.confirm_usage = {}
    app.state.geocoder = geocoder or Geocoder(settings)
    app.state.area_streets = AreaStreetWorker(app.state.geocoder, settings.database_path)

    conn = connect(settings.database_path)
    try:
        init_db(conn)
        auth.seed_demo_reviewer(conn, settings)
        if settings.seed_demo_data:
            seed_demo_reports(conn)
        app.state.area_streets.enqueue_public_reports(conn)
    finally:
        conn.close()
    app.state.area_streets.start()  # no-op when street names are disabled

    if any("*" in o for o in settings.allowed_origins):
        raise ValueError("Wildcard CORS origins are not allowed.")
    if settings.allowed_origins:
        # Bearer tokens travel in the Authorization header, not cookies, so credentials stay off.
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.allowed_origins),
            allow_methods=["GET", "POST"],
            allow_headers=["Authorization", "Content-Type", "X-Device-Id"],
            allow_credentials=False,
            max_age=600,
        )

    app.add_exception_handler(RequestValidationError, request_validation_handler)
    for r in (auth.router, reports.router, public.router, review.router, geo.router):
        app.include_router(r)

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "emergency_notice": EMERGENCY_MESSAGE_RO,
            "emergency_notice_en": EMERGENCY_MESSAGE_EN,
        }

    return app
