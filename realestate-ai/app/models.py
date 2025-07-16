from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

JSONType = JSON().with_variant(JSONB(), "postgresql")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="agent")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Property(Base):
    __tablename__ = "properties"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    address: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String)
    state: Mapped[str] = mapped_column(String)
    zip_code: Mapped[str] = mapped_column(String)
    property_type: Mapped[str] = mapped_column(String)
    beds: Mapped[int] = mapped_column(Integer)
    baths: Mapped[float] = mapped_column(Numeric(4, 1, asdecimal=False))
    sqft: Mapped[int] = mapped_column(Integer)
    lot_sqft: Mapped[int] = mapped_column(Integer, default=0)
    year_built: Mapped[int] = mapped_column(Integer)
    garage_spaces: Mapped[int] = mapped_column(Integer, default=0)
    condition: Mapped[int] = mapped_column(Integer, default=3)
    list_price: Mapped[float] = mapped_column(Numeric(14, 2, asdecimal=False))
    owner_name: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_email: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)
    budget_min: Mapped[float | None] = mapped_column(Numeric(14, 2, asdecimal=False), nullable=True)
    budget_max: Mapped[float | None] = mapped_column(Numeric(14, 2, asdecimal=False), nullable=True)
    min_beds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_baths: Mapped[float | None] = mapped_column(Numeric(4, 1, asdecimal=False), nullable=True)
    preferred_cities: Mapped[list[Any]] = mapped_column(JSONType, default=list)
    property_types: Mapped[list[Any]] = mapped_column(JSONType, default=list)
    liked_property_ids: Mapped[list[Any]] = mapped_column(JSONType, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class OutreachMessage(Base):
    __tablename__ = "outreach_messages"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"))
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    audience: Mapped[str] = mapped_column(String)  # owner | lead
    recipient_email: Mapped[str | None] = mapped_column(String, nullable=True)
    subject: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    generated_by: Mapped[str] = mapped_column(String, default="template")
    status: Mapped[str] = mapped_column(String, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    """Read-only mirror of the trigger-maintained audit table (populated on Postgres)."""

    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    table_name: Mapped[str] = mapped_column(String)
    record_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    action: Mapped[str] = mapped_column(String)
    changed_fields: Mapped[list[Any]] = mapped_column(JSONType, default=list)
    old_data: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    new_data: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
