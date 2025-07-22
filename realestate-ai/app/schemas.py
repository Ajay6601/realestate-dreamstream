from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

PropertyType = Literal["single_family", "condo", "townhouse", "multi_family"]
PropertyStatus = Literal["active", "pending", "sold", "withdrawn"]
Email = Annotated[str, StringConstraints(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth ---------------------------------------------------------------------------
class SignupIn(BaseModel):
    email: Email
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]
    company_name: Name


class LoginIn(BaseModel):
    email: Email
    password: str


class NewUserIn(BaseModel):
    email: Email
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]
    role: Literal["admin", "agent"] = "agent"


class UserOut(ORM):
    id: uuid.UUID
    email: str
    role: str
    tenant_id: uuid.UUID


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_id: uuid.UUID
    role: str


# ---- properties ---------------------------------------------------------------------
class ValuationFeatures(BaseModel):
    city: Name
    property_type: PropertyType
    beds: int = Field(ge=0, le=20)
    baths: float = Field(ge=0, le=20)
    sqft: int = Field(ge=200, le=50_000)
    lot_sqft: int = Field(default=0, ge=0)
    year_built: int = Field(ge=1800, le=2100)
    garage_spaces: int = Field(default=0, ge=0, le=10)
    condition: int = Field(default=3, ge=1, le=5)


class PropertyIn(ValuationFeatures):
    address: Name
    state: Annotated[str, StringConstraints(min_length=2, max_length=2, to_upper=True)]
    zip_code: Annotated[str, StringConstraints(pattern=r"^\d{5}(-\d{4})?$")]
    list_price: float = Field(gt=0)
    owner_name: str | None = Field(default=None, max_length=200)
    owner_email: Email | None = None
    status: PropertyStatus = "active"


class PropertyPatch(BaseModel):
    list_price: float | None = Field(default=None, gt=0)
    status: PropertyStatus | None = None
    owner_name: str | None = Field(default=None, max_length=200)
    owner_email: Email | None = None
    condition: int | None = Field(default=None, ge=1, le=5)


class PropertyOut(ORM):
    id: uuid.UUID
    address: str
    city: str
    state: str
    zip_code: str
    property_type: str
    beds: int
    baths: float
    sqft: int
    lot_sqft: int
    year_built: int
    garage_spaces: int
    condition: int
    list_price: float
    owner_name: str | None
    owner_email: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class PropertyPage(BaseModel):
    items: list[PropertyOut]
    total: int
    limit: int
    offset: int


# ---- leads --------------------------------------------------------------------------
class LeadIn(BaseModel):
    name: Name
    email: Email
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, gt=0)
    min_beds: int | None = Field(default=None, ge=0, le=20)
    min_baths: float | None = Field(default=None, ge=0, le=20)
    preferred_cities: list[str] = []
    property_types: list[PropertyType] = []
    liked_property_ids: list[uuid.UUID] = []


class LeadOut(ORM):
    id: uuid.UUID
    name: str
    email: str
    budget_min: float | None
    budget_max: float | None
    min_beds: int | None
    min_baths: float | None
    preferred_cities: list[str]
    property_types: list[str]
    liked_property_ids: list[str]
    created_at: datetime


# ---- valuation / recommendations ----------------------------------------------------
class EstimateOut(BaseModel):
    estimate: float
    low: float
    high: float
    model_version: str
    warning: str | None = None


class PropertyValuationOut(EstimateOut):
    property_id: uuid.UUID
    list_price: float
    discount_pct: float  # (estimate - list) / estimate; positive = listed below model value
    verdict: Literal["undervalued", "fairly_priced", "overpriced"]


class OpportunityOut(BaseModel):
    property: PropertyOut
    estimate: float
    low: float
    high: float
    discount_pct: float


class RecommendationOut(BaseModel):
    property: PropertyOut
    score: float
    reasons: list[str]
    components: dict[str, float]


class SimilarOut(BaseModel):
    property: PropertyOut
    similarity: float


# ---- outreach -----------------------------------------------------------------------
class DraftIn(BaseModel):
    property_id: uuid.UUID
    lead_id: uuid.UUID | None = None  # set -> pitch the property to a buyer lead; unset -> contact the owner


class OutreachPatch(BaseModel):
    subject: str | None = Field(default=None, min_length=1, max_length=300)
    body: str | None = Field(default=None, min_length=1)


class OutreachOut(ORM):
    id: uuid.UUID
    property_id: uuid.UUID
    lead_id: uuid.UUID | None
    audience: str
    recipient_email: str | None
    subject: str
    body: str
    generated_by: str
    status: str
    created_at: datetime
    sent_at: datetime | None


class BulkDraftOut(BaseModel):
    created: int
    skipped: int
    drafts: list[OutreachOut]


class AuditOut(ORM):
    id: int
    table_name: str
    record_id: uuid.UUID
    action: str
    changed_fields: list[str]
    changed_by: uuid.UUID | None
    changed_at: datetime
    old_data: dict | None
    new_data: dict | None
