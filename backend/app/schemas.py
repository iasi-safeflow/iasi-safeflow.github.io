"""Pydantic request/response models. Validation messages are Romanian (shown in the app)."""

from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .domain import CATEGORIES, IASI_BOUNDS, REJECTION_REASONS, STATUSES


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def bcrypt_limit(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Parola poate avea cel mult 72 de octeți.")
        return v


class UserOut(BaseModel):
    id: int
    email: str
    role: Literal["reporter", "reviewer"]


class AuthOut(BaseModel):
    token: str
    user: UserOut


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str
    description: str = Field(min_length=10, max_length=1000)
    lat: float
    lon: float
    location_source: Literal["pin", "gps"]
    gps_accuracy_m: float | None = Field(default=None, ge=0, le=5000)
    observed_at: datetime
    # Required answer to "Is anyone injured or in immediate danger right now?" — True never reaches this model.
    immediate_danger: Literal[False]

    @field_validator("category")
    @classmethod
    def known_category(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError("Categorie necunoscută.")
        return v

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Descrierea trebuie să aibă cel puțin 10 caractere.")
        return v

    @model_validator(mode="after")
    def check_location_and_time(self) -> "ReportCreate":
        b = IASI_BOUNDS
        if not (b["lat_min"] <= self.lat <= b["lat_max"] and b["lon_min"] <= self.lon <= b["lon_max"]):
            raise ValueError("Locația trebuie să fie în zona Iașiului.")
        if self.observed_at.tzinfo is None:
            raise ValueError("Ora observației trebuie să includă fusul orar.")
        now = datetime.now(timezone.utc)
        if self.observed_at > now + timedelta(minutes=5):
            raise ValueError("Ora observației nu poate fi în viitor.")
        if self.observed_at < now - timedelta(days=365):
            raise ValueError("Observația nu poate fi mai veche de un an.")
        return self


class StatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    # Private reviewer note: kept in the audit log, never shown to the reporter.
    notes: str = Field(default="", max_length=500)
    reason: str | None = None

    @field_validator("status")
    @classmethod
    def known_status(cls, v: str) -> str:
        if v not in STATUSES:
            raise ValueError("Status necunoscut.")
        return v

    @field_validator("reason")
    @classmethod
    def known_reason(cls, v: str | None) -> str | None:
        if v is not None and v not in REJECTION_REASONS:
            raise ValueError("Motiv de respingere necunoscut.")
        return v

    @model_validator(mode="after")
    def reason_only_when_rejecting(self) -> "StatusChange":
        if self.status == "rejected" and self.reason is None:
            raise ValueError("Alegeți motivul respingerii.")
        if self.status != "rejected" and self.reason is not None:
            raise ValueError("Motivul se completează doar la respingere.")
        return self


class DuplicateDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # link: the newer report is rejected as a duplicate of the older one (+1 corroboration for the older one).
    # not_duplicate: the pair is not suggested again. revoke: undoes a link and reopens the newer report.
    action: Literal["link", "not_duplicate", "revoke"]
    notes: str = Field(default="", max_length=500)
