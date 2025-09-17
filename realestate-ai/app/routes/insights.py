"""AI endpoints: valuation, undervalued-deal discovery, lead matching, similar homes."""
from __future__ import annotations

import uuid

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import Principal, get_predictor, get_principal, get_session
from app.models import Property
from app.routes.leads import get_owned_lead
from app.routes.properties import get_owned_property
from app.schemas import (
    EstimateOut,
    OpportunityOut,
    PropertyOut,
    PropertyValuationOut,
    RecommendationOut,
    SimilarOut,
    ValuationFeatures,
)
from app.services.valuation import estimate_frame, properties_frame, verdict
from ml.inference import PricePredictor
from ml.recommender import PropertyRecommender

router = APIRouter(tags=["insights"])


def _active_frame(session: Session, tenant_id: uuid.UUID, predictor: PricePredictor | None) -> pd.DataFrame:
    props = session.scalars(select(Property).where(Property.tenant_id == tenant_id)).all()
    frame = properties_frame(props)
    if frame.empty or predictor is None:
        return frame
    return estimate_frame(predictor, frame)


def _props_by_id(session: Session, tenant_id: uuid.UUID, ids: list[str]) -> dict[str, Property]:
    if not ids:
        return {}
    rows = session.scalars(
        select(Property).where(Property.tenant_id == tenant_id, Property.id.in_([uuid.UUID(i) for i in ids]))
    ).all()
    return {str(p.id): p for p in rows}


@router.post("/valuation/estimate", response_model=EstimateOut)
def estimate(
    body: ValuationFeatures,
    predictor: PricePredictor = Depends(get_predictor),
    _: Principal = Depends(get_principal),
):
    return predictor.predict_one(body.model_dump())


@router.get("/properties/{property_id}/valuation", response_model=PropertyValuationOut)
def property_valuation(
    property_id: uuid.UUID,
    predictor: PricePredictor = Depends(get_predictor),
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    prop = get_owned_property(session, who.tenant_id, property_id)
    row = estimate_frame(predictor, properties_frame([prop])).iloc[0]
    return PropertyValuationOut(
        property_id=prop.id,
        estimate=round(float(row["estimate"]), -2),
        low=round(float(row["low"]), -2),
        high=round(float(row["high"]), -2),
        model_version=predictor.version,
        warning=row["warning"],
        list_price=float(prop.list_price),
        discount_pct=round(float(row["discount"]), 4),
        verdict=verdict(float(row["discount"])),
    )


@router.get("/opportunities", response_model=list[OpportunityOut])
def opportunities(
    min_discount: float = Query(0.08, ge=0, le=0.5, description="model estimate must exceed ask by this fraction"),
    limit: int = Query(20, ge=1, le=100),
    predictor: PricePredictor = Depends(get_predictor),
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    frame = _active_frame(session, who.tenant_id, predictor)
    if frame.empty:
        return []
    frame = frame[(frame["status"] == "active") & (frame["discount"] >= min_discount)]
    frame = frame.sort_values("discount", ascending=False).head(limit)
    by_id = _props_by_id(session, who.tenant_id, frame["id"].tolist())
    return [
        OpportunityOut(
            property=PropertyOut.model_validate(by_id[r.id]),
            estimate=round(float(r.estimate), -2),
            low=round(float(r.low), -2),
            high=round(float(r.high), -2),
            discount_pct=round(float(r.discount), 4),
        )
        for r in frame.itertuples()
    ]


@router.get("/leads/{lead_id}/recommendations", response_model=list[RecommendationOut])
def lead_recommendations(
    lead_id: uuid.UUID,
    request: Request,
    k: int = Query(5, ge=1, le=25),
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    lead = get_owned_lead(session, who.tenant_id, lead_id)
    frame = _active_frame(session, who.tenant_id, request.app.state.predictor)
    if frame.empty:
        return []
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
        k=k,
    )
    by_id = _props_by_id(session, who.tenant_id, [r.property_id for r in recs])
    return [
        RecommendationOut(
            property=PropertyOut.model_validate(by_id[r.property_id]),
            score=r.score,
            reasons=r.reasons,
            components=r.components,
        )
        for r in recs
    ]


@router.get("/properties/{property_id}/similar", response_model=list[SimilarOut])
def similar_properties(
    property_id: uuid.UUID,
    k: int = Query(5, ge=1, le=25),
    session: Session = Depends(get_session),
    who: Principal = Depends(get_principal),
):
    get_owned_property(session, who.tenant_id, property_id)  # 404 if not ours
    frame = properties_frame(session.scalars(select(Property).where(Property.tenant_id == who.tenant_id)).all())
    try:
        sims = PropertyRecommender(frame).similar(str(property_id), k=k)
    except KeyError:
        raise HTTPException(404, "property not found") from None
    by_id = _props_by_id(session, who.tenant_id, [pid for pid, _ in sims])
    return [SimilarOut(property=PropertyOut.model_validate(by_id[pid]), similarity=round(s, 4)) for pid, s in sims]
