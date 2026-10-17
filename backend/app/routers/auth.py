"""Email + password accounts. Public registration always creates a 'reporter'; reviewers are seeded from .env."""

import sqlite3
import time

from fastapi import APIRouter, Depends, Request

from ..config import Settings
from ..db import iso, utcnow
from ..deps import current_user, get_db, get_settings
from ..errors import api_error
from ..schemas import AuthOut, Credentials, UserOut
from ..security import hash_password, issue_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(row: sqlite3.Row) -> UserOut:
    return UserOut(id=row["id"], email=row["email"], role=row["role"])


@router.post("/register", response_model=AuthOut, status_code=201)
def register(body: Credentials, settings: Settings = Depends(get_settings), db: sqlite3.Connection = Depends(get_db)):
    email = body.email.lower()
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise api_error(409, "email_taken", "Există deja un cont cu acest e-mail.")
    with db:
        cur = db.execute(
            "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'reporter', ?)",
            (email, hash_password(body.password), iso(utcnow())),
        )
    row = db.execute("SELECT id, email, role FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return AuthOut(token=issue_token(settings.secret_key, row["id"]), user=_user_out(row))


@router.post("/login", response_model=AuthOut)
def login(
    body: Credentials,
    request: Request,
    settings: Settings = Depends(get_settings),
    db: sqlite3.Connection = Depends(get_db),
):
    email = body.email.lower()
    failures: dict[str, list[float]] = request.app.state.login_failures
    now = time.monotonic()
    recent = [t for t in failures.get(email, []) if now - t < settings.login_window_seconds]
    if len(recent) >= settings.login_max_failures:
        raise api_error(429, "too_many_attempts", "Prea multe încercări. Încercați din nou mai târziu.")

    row = db.execute("SELECT id, email, role, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        failures[email] = recent + [now]
        raise api_error(401, "invalid_credentials", "E-mail sau parolă incorecte.")
    failures.pop(email, None)
    return AuthOut(token=issue_token(settings.secret_key, row["id"]), user=_user_out(row))


@router.get("/me", response_model=UserOut)
def me(user: sqlite3.Row = Depends(current_user)):
    return _user_out(user)


def seed_demo_reviewer(db: sqlite3.Connection, settings: Settings) -> None:
    """Create the demo reviewer from .env if it does not exist. Never overwrites an existing account."""
    if not (settings.demo_reviewer_email and settings.demo_reviewer_password):
        return
    email = settings.demo_reviewer_email.lower()
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        return
    with db:
        db.execute(
            "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'reviewer', ?)",
            (email, hash_password(settings.demo_reviewer_password), iso(utcnow())),
        )
