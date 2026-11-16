"""Shared in-memory sliding-window rate limiter and client IP helper."""

import time
from collections import deque

from fastapi import Request

from .errors import api_error


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def check_rate_limit(bucket: dict[str, deque], key: str, limit: int, window_s: int, message: str) -> None:
    now = time.monotonic()
    q = bucket.setdefault(key, deque())
    while q and now - q[0] > window_s:
        q.popleft()
    if len(q) >= limit:
        raise api_error(429, "rate_limited", message)
    q.append(now)
