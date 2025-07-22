from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import Principal, get_service_session, require_admin
from app.models import Tenant, User
from app.schemas import LoginIn, NewUserIn, SignupIn, TokenOut, UserOut
from app.security import burn_password_check, create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _token(request: Request, user: User) -> TokenOut:
    s = request.app.state.settings
    return TokenOut(
        access_token=create_token(s.jwt_secret, str(user.id), str(user.tenant_id), user.role, s.jwt_expire_minutes),
        tenant_id=user.tenant_id,
        role=user.role,
    )


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, request: Request, session: Session = Depends(get_service_session)):
    email = body.email.lower()
    if session.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    tenant = Tenant(name=body.company_name)
    session.add(tenant)
    session.flush()
    user = User(tenant_id=tenant.id, email=email, password_hash=hash_password(body.password), role="admin")
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered") from None
    return _token(request, user)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def add_user(
    body: NewUserIn,
    who: Principal = Depends(require_admin),
    session: Session = Depends(get_service_session),
):
    """Admins add teammates to their own tenant (tenant comes from the token, never the body)."""
    email = body.email.lower()
    if session.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    user = User(tenant_id=who.tenant_id, email=email, password_hash=hash_password(body.password), role=body.role)
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered") from None
    return user


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, session: Session = Depends(get_service_session)):
    user = session.scalar(select(User).where(User.email == body.email.lower()))
    if user is None:
        burn_password_check(body.password)
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")
    return _token(request, user)
