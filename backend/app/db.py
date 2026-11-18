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
    # 2: review assistant results and reviewer decisions about duplicates, both append-only
    (
        """CREATE TABLE assistant_runs (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               report_id INTEGER NOT NULL REFERENCES reports(id),
               triggered_by TEXT NOT NULL CHECK (triggered_by IN ('created', 'nearby_report', 'reviewer_decision')),
               assistant_version TEXT NOT NULL,
               created_at TEXT NOT NULL,
               importance_score INTEGER NOT NULL,
               importance_level TEXT NOT NULL,
               factors_json TEXT NOT NULL,
               flags_json TEXT NOT NULL,
               duplicates_json TEXT NOT NULL,
               -- Newest audit entry when the check ran: the reviewer's next decision is the first entry after it.
               last_action_id INTEGER NOT NULL DEFAULT 0
           )""",
        "CREATE INDEX idx_assistant_runs_report ON assistant_runs (report_id, id)",
        "CREATE INDEX idx_review_actions_report ON review_actions (report_id, id)",
        """CREATE TRIGGER assistant_runs_no_update BEFORE UPDATE ON assistant_runs
           BEGIN SELECT RAISE(ABORT, 'assistant history is append-only'); END""",
        """CREATE TRIGGER assistant_runs_no_delete BEFORE DELETE ON assistant_runs
           BEGIN SELECT RAISE(ABORT, 'assistant history is append-only'); END""",
        # report_id is the newer report, related_report_id the one it duplicates. The latest row for a pair wins.
        """CREATE TABLE report_relations (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               report_id INTEGER NOT NULL REFERENCES reports(id),
               related_report_id INTEGER NOT NULL REFERENCES reports(id),
               relation_type TEXT NOT NULL
                   CHECK (relation_type IN ('duplicate_confirmed', 'not_duplicate', 'duplicate_revoked')),
               reviewer_id INTEGER NOT NULL REFERENCES users(id),
               created_at TEXT NOT NULL,
               CHECK (report_id <> related_report_id)
           )""",
        "CREATE INDEX idx_report_relations_report ON report_relations (report_id)",
        "CREATE INDEX idx_report_relations_related ON report_relations (related_report_id)",
        """CREATE TRIGGER report_relations_no_update BEFORE UPDATE ON report_relations
           BEGIN SELECT RAISE(ABORT, 'report relations are append-only'); END""",
        """CREATE TRIGGER report_relations_no_delete BEFORE DELETE ON report_relations
           BEGIN SELECT RAISE(ABORT, 'report relations are append-only'); END""",
        "ALTER TABLE review_actions ADD COLUMN related_report_id INTEGER REFERENCES reports(id)",
    ),
    # 3: cached street names from the geocoding service (app/geocoding.py)
    (
        """CREATE TABLE geocode_cache (
               key TEXT PRIMARY KEY,
               value_json TEXT NOT NULL,
               fetched_at TEXT NOT NULL
           )""",
    ),
    # 4: 1-tap citizen confirmations ("Și eu am observat") per report and actor
    (
        """CREATE TABLE report_confirmations (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               report_id INTEGER NOT NULL REFERENCES reports(id),
               actor_key TEXT NOT NULL,
               user_id INTEGER REFERENCES users(id),
               is_simulated INTEGER NOT NULL DEFAULT 0,
               created_at TEXT NOT NULL,
               UNIQUE (report_id, actor_key)
           )""",
        "CREATE INDEX idx_report_confirmations_report ON report_confirmations (report_id)",
    ),
    # 5: civic points ledger, priority boosts, and trusted confirmation weight
    (
        "ALTER TABLE report_confirmations ADD COLUMN weight INTEGER NOT NULL DEFAULT 1",
        """CREATE TABLE point_events (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               user_id INTEGER NOT NULL REFERENCES users(id),
               report_id INTEGER REFERENCES reports(id),
               kind TEXT NOT NULL,
               delta INTEGER NOT NULL,
               description TEXT NOT NULL,
               created_at TEXT NOT NULL,
               UNIQUE (user_id, report_id, kind)
           )""",
        "CREATE INDEX idx_point_events_user ON point_events (user_id, id DESC)",
        """CREATE TABLE report_boosts (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               report_id INTEGER NOT NULL REFERENCES reports(id),
               user_id INTEGER NOT NULL REFERENCES users(id),
               cost INTEGER NOT NULL,
               created_at TEXT NOT NULL,
               UNIQUE (report_id, user_id)
           )""",
        "CREATE INDEX idx_report_boosts_report ON report_boosts (report_id)",
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
