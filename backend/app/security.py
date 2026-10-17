"""Password hashing (bcrypt) and signed, expiring session tokens (itsdangerous)."""

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

_SALT = "safeflow-session-v1"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


def issue_token(secret: str, user_id: int) -> str:
    return URLSafeTimedSerializer(secret, salt=_SALT).dumps({"uid": user_id})


def read_token(secret: str, token: str, max_age: int) -> int | None:
    """Return the user id, or None if the token is invalid or expired. The role is always re-read from the DB."""
    try:
        data = URLSafeTimedSerializer(secret, salt=_SALT).loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    uid = data.get("uid") if isinstance(data, dict) else None
    return uid if isinstance(uid, int) else None
