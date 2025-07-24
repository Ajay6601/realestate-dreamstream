from __future__ import annotations

import uuid
from collections.abc import Iterator
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import bind_rls_context
from app.security import decode_token
from ml.inference import PricePredictor

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    role: str


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_principal(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        claims = decode_token(request.app.state.settings.jwt_secret, creds.credentials)
        return Principal(uuid.UUID(claims["sub"]), uuid.UUID(claims["tenant_id"]), claims.get("role", "agent"))
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token") from None


def require_admin(principal: Principal = Depends(get_principal)) -> Principal:
    if principal.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin role required")
    return principal


def get_service_session(request: Request) -> Iterator[Session]:
    """RLS-bypassing session. Only for signup/login, which run before a tenant exists."""
    with Session(request.app.state.admin_engine) as session:
        yield session


def get_session(request: Request, principal: Principal = Depends(get_principal)) -> Iterator[Session]:
    """Tenant-scoped session: Postgres RLS context is bound, and routes also filter by tenant."""
    with Session(request.app.state.engine) as session:
        bind_rls_context(session, str(principal.tenant_id), str(principal.user_id), principal.role)
        yield session


def get_predictor(request: Request) -> PricePredictor:
    predictor = request.app.state.predictor
    if predictor is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "no price model is promoted yet")
    return predictor
