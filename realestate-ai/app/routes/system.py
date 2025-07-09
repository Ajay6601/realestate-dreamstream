from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import Principal, get_principal, get_session, require_admin
from app.models import AuditLog
from app.schemas import AuditOut

router = APIRouter(tags=["system"])


@router.get("/health")
def health(request: Request):
    predictor = request.app.state.predictor
    return {"status": "ok", "model_version": predictor.version if predictor else None}


@router.get("/model")
def model_info(request: Request, _: Principal = Depends(get_principal)):
    predictor = request.app.state.predictor
    if predictor is None:
        raise HTTPException(503, "no price model is promoted yet")
    return predictor.info


@router.get("/audit", response_model=list[AuditOut])
def audit_trail(
    table: str | None = Query(None, pattern="^(properties|leads|outreach_messages)$"),
    record_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=500),
    session: Session = Depends(get_session),
    who: Principal = Depends(require_admin),
):
    """Tenant change history. Populated by Postgres triggers, so it is empty on the SQLite dev DB."""
    stmt = select(AuditLog).where(AuditLog.tenant_id == who.tenant_id)
    if table:
        stmt = stmt.where(AuditLog.table_name == table)
    if record_id:
        stmt = stmt.where(AuditLog.record_id == record_id)
    return session.scalars(stmt.order_by(AuditLog.id.desc()).limit(limit)).all()
