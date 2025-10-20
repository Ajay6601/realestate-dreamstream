from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.deps import Principal, get_predictor, get_principal, get_session, get_settings
from app.models import OutreachMessage, Property
from app.routes.leads import get_owned_lead
from app.routes.properties import get_owned_property
from app.schemas import BulkDraftOut, DraftIn, OutreachOut, OutreachPatch
from app.services.outreach import OutreachContext, compose
from app.services.valuation import estimate_frame, properties_frame
from ml.inference import PricePredictor
from ml.recommender import PropertyRecommender

router = APIRouter(prefix="/outreach", tags=["outreach"])


def _context(prop: Property, row, audience: str, name: str | None, reasons: list[str]) -> OutreachContext:
    return OutreachContext(
        audience=audience,
        address=prop.address,
        city=prop.city,
        beds=prop.beds,
        baths=float(prop.baths),
        sqft=prop.sqft,
        list_price=float(prop.list_price),
        estimate=round(float(row["estimate"]), -2),
        low=round(float(row["low"]), -2),
        high=round(float(row["high"]), -2),
        discount=float(row["discount"]),
        recipient_name=name,
        reasons=reasons,
    )


def _store(session: Session, who: Principal, prop: Property, ctx: OutreachContext, settings: Settings,
           audience: str, lead_id: uuid.UUID | None, recipient: str | None) -> OutreachMessage:
    subject, body, generated_by = compose(ctx, settings)
    msg = OutreachMessage(
        tenant_id=who.tenant_id,
        property_id=prop.id,
        lead_id=lead_id,
        audience=audience,
        recipient_email=recipient,
        subject=subject,
        body=body,
        generated_by=generated_by,
    )
    session.add(msg)
    return msg


@router.post("/draft", response_model=OutreachOut, status_code=status.HTTP_201_CREATED)
def draft(
    body: DraftIn,
    request: Request,
    predictor: PricePredictor = Depends(get_predictor),
    settings: Settings = Depends(get_settings),
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    prop = get_owned_property(session, who.tenant_id, body.property_id)
    row = estimate_frame(predictor, properties_frame([prop])).iloc[0]

    if body.lead_id:
        lead = get_owned_lead(session, who.tenant_id, body.lead_id)
        reasons = _match_reasons(session, who, prop, lead, request)
        ctx = _context(prop, row, "lead", lead.name, reasons)
        msg = _store(session, who, prop, ctx, settings, "lead", lead.id, lead.email)
    else:
        if not prop.owner_email:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "property has no owner_email to contact")
        ctx = _context(prop, row, "owner", prop.owner_name, [])
        msg = _store(session, who, prop, ctx, settings, "owner", None, prop.owner_email)
    session.commit()
    session.refresh(msg)
    return msg


def _match_reasons(session: Session, who: Principal, prop: Property, lead, request: Request) -> list[str]:
    """Reuse the recommender so the pitch cites the same reasons the match score used."""
    props = session.scalars(select(Property).where(Property.tenant_id == who.tenant_id)).all()
    frame = properties_frame(props)
    predictor = request.app.state.predictor
    if predictor is not None:
        frame = estimate_frame(predictor, frame)
    recs = PropertyRecommender(frame).recommend_for_lead(
        {
            "budget_min": lead.budget_min,
            "budget_max": lead.budget_max,
            "min_beds": lead.min_beds,
            "min_baths": lead.min_baths,
            "preferred_cities": lead.preferred_cities,
            "property_types": lead.property_types,
            "liked_property_ids": lead.liked_property_ids,
        },
        k=len(frame) or 1,
    )
    for r in recs:
        if r.property_id == str(prop.id):
            return r.reasons
    return []


@router.post("/bulk-draft", response_model=BulkDraftOut)
def bulk_draft(
    min_discount: float = Query(0.08, ge=0, le=0.5),
    limit: int = Query(20, ge=1, le=100),
    predictor: PricePredictor = Depends(get_predictor),
    settings: Settings = Depends(get_settings),
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    """Draft owner outreach for the most under-priced active listings that have no draft yet."""
    props = session.scalars(
        select(Property).where(Property.tenant_id == who.tenant_id, Property.status == "active")
    ).all()
    frame = estimate_frame(predictor, properties_frame(props))
    if frame.empty:
        return BulkDraftOut(created=0, skipped=0, drafts=[])
    frame = frame[frame["discount"] >= min_discount].sort_values("discount", ascending=False)

    already = set(
        session.scalars(
            select(OutreachMessage.property_id).where(
                OutreachMessage.tenant_id == who.tenant_id, OutreachMessage.audience == "owner"
            )
        ).all()
    )
    by_id = {str(p.id): p for p in props}
    created: list[OutreachMessage] = []
    skipped = 0
    for _, row in frame.iterrows():
        if len(created) >= limit:
            break
        prop = by_id[row["id"]]
        if prop.id in already or not prop.owner_email:
            skipped += 1
            continue
        ctx = _context(prop, row, "owner", prop.owner_name, [])
        created.append(_store(session, who, prop, ctx, settings, "owner", None, prop.owner_email))
    session.commit()
    for m in created:
        session.refresh(m)
    return BulkDraftOut(created=len(created), skipped=skipped, drafts=created)


@router.get("", response_model=list[OutreachOut])
def list_messages(
    status_: Literal["draft", "sent"] | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    stmt = select(OutreachMessage).where(OutreachMessage.tenant_id == who.tenant_id)
    if status_:
        stmt = stmt.where(OutreachMessage.status == status_)
    return session.scalars(stmt.order_by(OutreachMessage.created_at.desc()).limit(limit)).all()


def _get_message(session: Session, who: Principal, message_id: uuid.UUID) -> OutreachMessage:
    msg = session.scalar(
        select(OutreachMessage).where(OutreachMessage.id == message_id, OutreachMessage.tenant_id == who.tenant_id)
    )
    if msg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "message not found")
    return msg


@router.patch("/{message_id}", response_model=OutreachOut)
def edit_draft(
    message_id: uuid.UUID,
    body: OutreachPatch,
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    msg = _get_message(session, who, message_id)
    if msg.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "only drafts can be edited")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(msg, key, value)
    session.commit()
    session.refresh(msg)
    return msg


@router.post("/{message_id}/mark-sent", response_model=OutreachOut)
def mark_sent(
    message_id: uuid.UUID, session: Session = Depends(get_session), who: Principal = Depends(get_principal)
):
    """Record that a human sent this message. (Delivery itself is out of scope: plug in SMTP/ESP here.)"""
    msg = _get_message(session, who, message_id)
    if msg.status == "sent":
        raise HTTPException(status.HTTP_409_CONFLICT, "already marked sent")
    if not msg.recipient_email:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "message has no recipient")
    msg.status = "sent"
    msg.sent_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(msg)
    return msg
