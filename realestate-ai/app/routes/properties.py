from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import Principal, get_principal, get_session, require_admin
from app.models import Property
from app.schemas import PropertyIn, PropertyOut, PropertyPage, PropertyPatch

router = APIRouter(prefix="/properties", tags=["properties"])

SORTS = {
    "newest": Property.created_at.desc(),
    "price_asc": Property.list_price.asc(),
    "price_desc": Property.list_price.desc(),
    "sqft_desc": Property.sqft.desc(),
}


def get_owned_property(session: Session, tenant_id: uuid.UUID, property_id: uuid.UUID) -> Property:
    prop = session.scalar(select(Property).where(Property.id == property_id, Property.tenant_id == tenant_id))
    if prop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "property not found")
    return prop


@router.post("", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
def create_property(
    body: PropertyIn, session: Session = Depends(get_session), who: Principal = Depends(get_principal)
):
    prop = Property(tenant_id=who.tenant_id, **body.model_dump())
    session.add(prop)
    session.commit()
    session.refresh(prop)
    return prop


@router.get("", response_model=PropertyPage)
def search_properties(
    q: str | None = Query(None, description="address contains"),
    city: str | None = None,
    state: str | None = None,
    property_type: str | None = None,
    status_: Literal["active", "pending", "sold", "withdrawn"] | None = Query(None, alias="status"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    min_beds: int | None = Query(None, ge=0),
    min_baths: float | None = Query(None, ge=0),
    min_sqft: int | None = Query(None, ge=0),
    sort: Literal["newest", "price_asc", "price_desc", "sqft_desc"] = "newest",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    stmt = select(Property).where(Property.tenant_id == who.tenant_id)
    if q:
        stmt = stmt.where(Property.address.icontains(q, autoescape=True))
    if city:
        stmt = stmt.where(func.lower(Property.city) == city.lower())
    if state:
        stmt = stmt.where(func.upper(Property.state) == state.upper())
    if property_type:
        stmt = stmt.where(Property.property_type == property_type)
    if status_:
        stmt = stmt.where(Property.status == status_)
    if min_price is not None:
        stmt = stmt.where(Property.list_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Property.list_price <= max_price)
    if min_beds is not None:
        stmt = stmt.where(Property.beds >= min_beds)
    if min_baths is not None:
        stmt = stmt.where(Property.baths >= min_baths)
    if min_sqft is not None:
        stmt = stmt.where(Property.sqft >= min_sqft)

    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = session.scalars(stmt.order_by(SORTS[sort], Property.id).limit(limit).offset(offset)).all()
    return PropertyPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/{property_id}", response_model=PropertyOut)
def get_property(
    property_id: uuid.UUID, session: Session = Depends(get_session), who: Principal = Depends(get_principal)
):
    return get_owned_property(session, who.tenant_id, property_id)


@router.patch("/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: uuid.UUID,
    body: PropertyPatch,
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    prop = get_owned_property(session, who.tenant_id, property_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(prop, key, value)
    session.commit()
    session.refresh(prop)
    return prop


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: uuid.UUID, session: Session = Depends(get_session), who: Principal = Depends(require_admin)
):
    prop = get_owned_property(session, who.tenant_id, property_id)
    session.delete(prop)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
