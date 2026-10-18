"""Settings loaded from environment variables (see .env.example at the repo root)."""

import logging
import os
import secrets
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent

log = logging.getLogger("safeflow")


@dataclass(frozen=True)
class Settings:
    database_path: str
    secret_key: str
    token_max_age_seconds: int = 7 * 24 * 3600
    demo_reviewer_email: str | None = None
    demo_reviewer_password: str | None = None
    report_rate_limit_per_hour: int = 10
    login_max_failures: int = 5
    login_window_seconds: int = 15 * 60
    # Exact browser origins allowed to call the API (e.g. the GitHub Pages site). Empty = no CORS headers.
    allowed_origins: tuple[str, ...] = ()
    # Insert the labelled simulated demo dataset at startup when the reports table is empty.
    seed_demo_data: bool = False
    # Street names (app/geocoding.py). Off by default so tests never reach the network; on in load_settings().
    geocoder_enabled: bool = False
    geocoder_url: str = "https://nominatim.openstreetmap.org"
    geocoder_user_agent: str = "IasiSafeFlow/0.3 (+https://iasi-safeflow.github.io; road-safety reporting prototype)"
    geocoder_cache_days: int = 30


def parse_allowed_origins(raw: str | None) -> tuple[str, ...]:
    """Comma-separated exact origins. A wildcard is refused: the API must never be open to every site."""
    origins = []
    for part in (raw or "").split(","):
        origin = part.strip().rstrip("/")
        if not origin:
            continue
        if "*" in origin:
            raise ValueError("SAFEFLOW_ALLOWED_ORIGINS must list exact origins; wildcards are not allowed.")
        if not origin.startswith(("https://", "http://")) or "/" in origin.split("://", 1)[1]:
            raise ValueError(f"Invalid origin {origin!r}: use scheme://host[:port] with no path.")
        origins.append(origin)
    return tuple(origins)


def load_settings() -> Settings:
    load_dotenv(REPO_ROOT / ".env")
    secret = os.getenv("SAFEFLOW_SECRET_KEY")
    if not secret:
        # An ephemeral key keeps the demo runnable, but every restart logs everyone out.
        log.warning("SAFEFLOW_SECRET_KEY is not set; using a random key for this process only.")
        secret = secrets.token_urlsafe(32)
    return Settings(
        database_path=os.getenv("SAFEFLOW_DB_PATH", str(BACKEND_DIR / "safeflow.db")),
        secret_key=secret,
        token_max_age_seconds=int(os.getenv("SAFEFLOW_TOKEN_MAX_AGE", 7 * 24 * 3600)),
        demo_reviewer_email=os.getenv("DEMO_REVIEWER_EMAIL") or None,
        demo_reviewer_password=os.getenv("DEMO_REVIEWER_PASSWORD") or None,
        report_rate_limit_per_hour=int(os.getenv("SAFEFLOW_REPORTS_PER_HOUR", 10)),
        allowed_origins=parse_allowed_origins(os.getenv("SAFEFLOW_ALLOWED_ORIGINS")),
        seed_demo_data=_flag("SAFEFLOW_SEED_DEMO_DATA", "1"),
        geocoder_enabled=_flag("SAFEFLOW_GEOCODER_ENABLED", "1"),
        geocoder_url=os.getenv("SAFEFLOW_GEOCODER_URL", Settings.geocoder_url).rstrip("/"),
        geocoder_user_agent=os.getenv("SAFEFLOW_GEOCODER_USER_AGENT", Settings.geocoder_user_agent),
    )


def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "")
