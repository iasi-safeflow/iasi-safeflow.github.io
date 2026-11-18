"""Simulated demo dataset, inserted at startup only when the reports table is empty.

Every row is marked is_simulated=1 / source_type='simulated' and its description starts with [SIMULAT], so the UI
labels it "Date simulate". Statuses are only submitted/under_review:
nothing here implies a referral or an authority response. Locations are generic points in Iași; no real reports or personal data.

The review assistant checks every demo report at seed time, so the demo shows: a duplicate pair (TESTDEM2/TESTDEMA),
a held report with a licence plate (TESTDEMB; "IS 00 QQQ" is deliberately invalid: no plate uses 00 or Q), a
high-importance school crossing (TESTDEMC) and a held vague report (TESTDEMD).
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
    ("SF-TESTDEMA", "defect_carosabil", "Groapă adâncă pe banda din dreapta, mașinile o ocolesc brusc (exemplu de test).", 47.16258, 27.58870, 3, "submitted"),
    ("SF-TESTDEMB", "banda_blocata", "Autoturismul IS 00 QQQ oprește zilnic pe banda de autobuz (exemplu de test, număr fictiv).", 47.15950, 27.59640, 6, "submitted"),
    ("SF-TESTDEMC", "trecere_pietoni_nesigura", "Copiii traversează spre școală pe o trecere fără semafor, iar mașinile nu încetinesc la ora de intrare (exemplu de test).", 47.17020, 27.56880, 2, "submitted"),
    ("SF-TESTDEMD", "intersectie_periculoasa", "Periculos aici.", 47.15480, 27.60900, 12, "submitted"),
    ("SF-TESTDEME", "tipar_near_miss", "Mașinile depășesc pe trecerea de pietoni din fața școlii fără să acorde prioritate (exemplu de test).", 47.17045, 27.56910, 14, "submitted"),
    ("SF-TESTDEMF", "iluminat_slab", "Iluminat insuficient la trecerea spre școală dimineața devreme și seara (exemplu de test).", 47.16995, 27.56840, 26, "under_review"),
)

# Simulated citizen confirmations so hotspot clusters and corroboration appear in the demo.
SEED_CONFIRMATIONS = (
    ("SF-TESTDEMC", 4),
    ("SF-TESTDEME", 2),
    ("SF-TESTDEMA", 2),
    ("SF-TESTDEM7", 3),
)

# Simulated approved updates/comments so the community updates modal is populated in the demo.
SEED_COMMENTS = (
    ("SF-TESTDEMC", "worse", "Situația se repetă zilnic între 07:45 și 08:15 când vin elevii la școală."),
    ("SF-TESTDEMA", "still_there", "Groapa s-a mărit după ultima ploaie, este greu de evitat pe banda 1."),
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
        id_by_public = {}
        for public_id, category, description, lat, lon, hours_ago, status in DEMO_REPORTS:
            observed = iso(now - timedelta(hours=hours_ago))
            cur = db.execute(
                """INSERT INTO reports (public_id, reporter_id, category, description, lat, lon, location_source,
                       gps_accuracy_m, observed_at, created_at, updated_at, source_type, is_simulated, status)
                   VALUES (?, ?, ?, ?, ?, ?, 'pin', NULL, ?, ?, ?, 'simulated', 1, ?)""",
                (public_id, owner, category, SIMULATED_PREFIX + description, lat, lon, observed, observed, observed, status),
            )
            id_by_public[public_id] = cur.lastrowid
        for public_id, count in SEED_CONFIRMATIONS:
            rid = id_by_public.get(public_id)
            if rid is None:
                continue
            for idx in range(count):
                db.execute(
                    """INSERT INTO report_confirmations (report_id, actor_key, user_id, is_simulated, created_at)
                       VALUES (?, ?, NULL, 1, ?)""",
                    (rid, f"sim:{public_id}:{idx}", iso(now - timedelta(hours=idx + 1))),
                )
        for idx, (public_id, tag, body) in enumerate(SEED_COMMENTS):
            rid = id_by_public.get(public_id)
            if rid is None:
                continue
            db.execute(
                """INSERT INTO report_comments
                       (report_id, user_id, actor_key, tag, body, moderation_status, flags_json, is_simulated, created_at)
                   VALUES (?, NULL, ?, ?, ?, 'approved', '[]', 1, ?)""",
                (rid, f"sim:{public_id}:c{idx}", tag, SIMULATED_PREFIX + body, iso(now - timedelta(hours=idx + 1))),
            )
        # Each demo report gets the same automatic check a real one would; flagged ones start out held.
        for row in db.execute("SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at, id", (owner,)).fetchall():
            result = assess(db, dict(row), now)
            record(db, row["id"], "created", result, now)
            if result["flags"]:
                db.execute("UPDATE reports SET public_visibility = 'held' WHERE id = ?", (row["id"],))
    return len(DEMO_REPORTS)
