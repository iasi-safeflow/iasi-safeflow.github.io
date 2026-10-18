"""Simulated demo dataset, inserted at startup only when the reports table is empty.

Every row is marked is_simulated=1 / source_type='simulated' and its description starts with [SIMULAT], so the UI
labels it "Date simulate". Statuses are only submitted/under_review:
nothing here implies a referral or an authority response. Locations are generic points in Iași; no real reports or personal data.
"""

import secrets
import sqlite3
from datetime import timedelta

from .assistant.runner import assess, record
from .db import iso, utcnow
from .domain import SIMULATED_PREFIX
from .security import hash_password

SEED_USER_EMAIL = "demo-seed@safeflow.invalid"  # placeholder owner; random password, cannot log in

# (public_id, category, description, lat, lon, hours_ago, status)
DEMO_REPORTS = (
    ("SF-TESTDEM2", "defect_carosabil", "Groapă pe banda din dreapta (exemplu de test).", 47.16240, 27.58860, 5, "submitted"),
    ("SF-TESTDEM3", "trecere_pietoni_nesigura", "Vizibilitate redusă la trecere din cauza mașinilor parcate (exemplu de test).", 47.17360, 27.57490, 30, "under_review"),
    ("SF-TESTDEM4", "intersectie_periculoasa", "Marcaje confuze la virajul la stânga (exemplu de test).", 47.15720, 27.60420, 52, "submitted"),
    ("SF-TESTDEM5", "iluminat_slab", "Iluminat stradal nefuncțional pe o porțiune scurtă (exemplu de test).", 47.15190, 27.58320, 75, "submitted"),
    ("SF-TESTDEM6", "semnalizare_lipsa", "Indicator de cedare a trecerii lipsă (exemplu de test).", 47.16880, 27.61350, 100, "submitted"),
    ("SF-TESTDEM7", "banda_blocata", "Bandă blocată frecvent de oprire neregulamentară (exemplu de test).", 47.16510, 27.58010, 8, "submitted"),
    ("SF-TESTDEM8", "tipar_near_miss", "Situații repetate de frânare bruscă la intrarea în sensul giratoriu (exemplu de test).", 47.14820, 27.61940, 140, "under_review"),
    ("SF-TESTDEM9", "coada_recurenta", "Coadă recurentă care ajunge până în intersecție la ore de vârf (exemplu de test).", 47.17830, 27.55900, 20, "submitted"),
)


def _seed_user_id(db: sqlite3.Connection) -> int:
    row = db.execute("SELECT id FROM users WHERE email = ?", (SEED_USER_EMAIL,)).fetchone()
    if row:
        return row["id"]
    cur = db.execute(
        "INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'reporter', ?)",
        (SEED_USER_EMAIL, hash_password(secrets.token_urlsafe(32)), iso(utcnow())),
    )
    return cur.lastrowid


def seed_demo_reports(db: sqlite3.Connection) -> int:
    """Insert DEMO_REPORTS if there are no reports at all. Returns the number of rows inserted."""
    if db.execute("SELECT 1 FROM reports LIMIT 1").fetchone():
        return 0
    now = utcnow()
    with db:
        owner = _seed_user_id(db)
        for public_id, category, description, lat, lon, hours_ago, status in DEMO_REPORTS:
            observed = iso(now - timedelta(hours=hours_ago))
            db.execute(
                """INSERT INTO reports (public_id, reporter_id, category, description, lat, lon, location_source,
                       gps_accuracy_m, observed_at, created_at, updated_at, source_type, is_simulated, status)
                   VALUES (?, ?, ?, ?, ?, ?, 'pin', NULL, ?, ?, ?, 'simulated', 1, ?)""",
                (public_id, owner, category, SIMULATED_PREFIX + description, lat, lon, observed, observed, observed, status),
            )
        # Each demo report gets the same automatic check a real one would; flagged ones start out held.
        for row in db.execute("SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at, id", (owner,)).fetchall():
            result = assess(db, dict(row), now)
            record(db, row["id"], "created", result, now)
            if result["flags"]:
                db.execute("UPDATE reports SET public_visibility = 'held' WHERE id = ?", (row["id"],))
    return len(DEMO_REPORTS)
