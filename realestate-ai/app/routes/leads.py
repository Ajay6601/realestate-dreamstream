from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import Principal, get_principal, get_session
from app.models import Lead
from app.schemas import LeadIn, LeadOut

router = APIRouter(prefix="/leads", tags=["leads"])


def get_owned_lead(session: Session, tenant_id: uuid.UUID, lead_id: uuid.UUID) -> Lead:
    lead = session.scalar(select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id))
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "lead not found")
    return lead


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(body: LeadIn, session: Session = Depends(get_session), who: Principal = Depends(get_principal)):
    if body.budget_min and body.budget_max and body.budget_min > body.budget_max:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "budget_min must be <= budget_max")
    data = body.model_dump()
    data["liked_property_ids"] = [str(i) for i in body.liked_property_ids]
    lead = Lead(tenant_id=who.tenant_id, **data)
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


@router.get("", response_model=list[LeadOut])
def list_leads(session: Session = Depends(get_session), who: Principal = Depends(get_principal)):
    return session.scalars(select(Lead).where(Lead.tenant_id == who.tenant_id).order_by(Lead.created_at.desc())).all()


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: uuid.UUID, session: Session = Depends(get_session), who: Principal = Depends(get_principal)):
    return get_owned_lead(session, who.tenant_id, lead_id)
