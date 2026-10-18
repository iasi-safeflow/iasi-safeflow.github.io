"""SQLite access. Plain sqlite3 keeps the schema readable; swap for PostgreSQL later."""

import sqlite3
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('reporter', 'reviewer')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    location_source TEXT NOT NULL CHECK (location_source IN ('pin', 'gps')),
    gps_accuracy_m REAL,
    observed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'user_report',
    is_simulated INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'submitted'
);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_created ON reports (reporter_id, created_at);

-- Audit log: append-only, enforced by triggers below.
CREATE TABLE IF NOT EXISTS review_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id),
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS review_actions_no_update BEFORE UPDATE ON review_actions
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS review_actions_no_delete BEFORE DELETE ON review_actions
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
"""


def connect(path: str) -> sqlite3.Connection:
    # FastAPI runs sync endpoints in a threadpool, so a request may span threads.
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# Schema changes after the first release, applied in order. PRAGMA user_version records how many have run, so
# existing databases keep their data and gain the new columns/tables. Append only; never edit a released step.
MIGRATIONS: tuple[tuple[str, ...], ...] = (
    # 1: reviewer validation, rejection reasons, held reports
    (
        """ALTER TABLE reports ADD COLUMN public_visibility TEXT NOT NULL DEFAULT 'public'
               CHECK (public_visibility IN ('public', 'held'))""",
        "ALTER TABLE reports ADD COLUMN rejection_reason TEXT",
        "ALTER TABLE review_actions ADD COLUMN reason TEXT",
    ),
)


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    for number, statements in enumerate(MIGRATIONS[version:], start=version + 1):
        conn.execute("BEGIN")
        try:
            for statement in statements:
                conn.execute(statement)
            conn.execute(f"PRAGMA user_version = {number}")
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")
