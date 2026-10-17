"""Uniform error bodies: {"detail": {"code": ..., "message": <Romanian>, ...}}."""

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def api_error(status_code: int, code: str, message: str, **extra) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message, **extra})


def format_validation_errors(errors: list[dict]) -> list[dict]:
    fields = []
    for err in errors:
        loc = [str(p) for p in err.get("loc", ()) if p not in ("body",)]
        msg = err.get("msg", "")
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        fields.append({"field": ".".join(loc), "message": msg})
    return fields


def validation_error_body(errors: list[dict]) -> dict:
    return {"detail": {"code": "validation_error", "message": "Date invalide.", "fields": format_validation_errors(errors)}}


async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content=validation_error_body(exc.errors()))
