"""Request dependencies: settings, DB connection, authenticated user and role checks."""

import sqlite3
from collections.abc import Iterator

from fastapi import Depends, Header, Request

from .config import Settings
from .db import connect
from .errors import api_error
from .security import read_token


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(settings: Settings = Depends(get_settings)) -> Iterator[sqlite3.Connection]:
    conn = connect(settings.database_path)
    try:
        yield conn
    finally:
        conn.close()


def optional_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    db: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    uid = read_token(settings.secret_key, authorization[len("Bearer "):], settings.token_max_age_seconds)
    if uid is None:
        return None
    return db.execute("SELECT id, email, role FROM users WHERE id = ?", (uid,)).fetchone()


def current_user(user: sqlite3.Row | None = Depends(optional_user)) -> sqlite3.Row:
    if user is None:
        raise api_error(401, "not_authenticated", "Trebuie să fiți autentificat.")
    return user


def require_reviewer(user: sqlite3.Row = Depends(current_user)) -> sqlite3.Row:
    if user["role"] != "reviewer":
        raise api_error(403, "forbidden", "Doar recenzenții au acces la această secțiune.")
    return user
