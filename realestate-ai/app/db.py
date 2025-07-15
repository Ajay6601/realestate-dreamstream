from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        kwargs: dict = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
        else:
            path = url.replace("sqlite:///", "", 1)
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        return create_engine(url, **kwargs)
    return create_engine(url, pool_pre_ping=True)


def bind_rls_context(session: Session, tenant_id: str, user_id: str, role: str) -> None:
    """Make Postgres RLS see who is calling, for *every* transaction of this session.

    ``set_config(..., is_local=true)`` is scoped to one transaction, so it is re-applied on
    each ``after_begin`` - otherwise the first ``commit()`` would silently drop the tenant
    context and the next query would see zero rows.
    """
    if session.get_bind().dialect.name != "postgresql":
        return

    @event.listens_for(session, "after_begin")
    def _set_context(sess, transaction, connection):  # noqa: ARG001
        connection.execute(
            text(
                "SELECT set_config('app.tenant_id', :t, true),"
                " set_config('app.user_id', :u, true),"
                " set_config('app.role', :r, true)"
            ),
            {"t": tenant_id, "u": user_id, "r": role},
        )
