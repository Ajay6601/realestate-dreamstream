"""Row-Level Security + audit-trigger tests, run against real Postgres.

These talk to the database directly as the unprivileged API role (app_user) so they prove
the *database* enforces isolation - independent of any filtering done in Python.
"""
import json
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from tests.conftest import PG_ADMIN_URL, PG_URL, requires_postgres

pytestmark = requires_postgres


@pytest.fixture(scope="module")
def admin():
    e = create_engine(PG_ADMIN_URL)
    yield e
    e.dispose()


@pytest.fixture(scope="module")
def api():
    e = create_engine(PG_URL)
    yield e
    e.dispose()


def _ctx(conn, tenant=None, user=None, role=None):
    conn.execute(
        text("select set_config('app.tenant_id', :t, true), set_config('app.user_id', :u, true), "
             "set_config('app.role', :r, true)"),
        {"t": str(tenant or ""), "u": str(user or ""), "r": role or ""},
    )


PROP_SQL = text(
    "insert into properties (id, tenant_id, address, city, state, zip_code, property_type, beds, baths, sqft,"
    " year_built, list_price) values (:id, :t, :addr, 'Austin', 'TX', '78701', 'condo', 2, 1.5, 900, 2001, 250000)"
)


@pytest.fixture
def world(admin):
    """Two tenants, one property each, created as superuser (bypasses RLS)."""
    ta, tb = uuid.uuid4(), uuid.uuid4()
    pa, pb = uuid.uuid4(), uuid.uuid4()
    with admin.begin() as c:
        for t in (ta, tb):
            c.execute(text("insert into tenants (id, name) values (:i, 't')"), {"i": t})
        c.execute(PROP_SQL, {"id": pa, "t": ta, "addr": "A house"})
        c.execute(PROP_SQL, {"id": pb, "t": tb, "addr": "B house"})
    return {"ta": ta, "tb": tb, "pa": pa, "pb": pb}


def _addresses(conn):
    return {r[0] for r in conn.execute(text("select address from properties"))}


def test_no_context_sees_nothing_and_cannot_write(api, world):
    with api.begin() as c:
        assert _addresses(c) == set()
    with pytest.raises(DBAPIError), api.begin() as c:
        c.execute(PROP_SQL, {"id": uuid.uuid4(), "t": world["ta"], "addr": "sneaky"})


def test_tenant_only_sees_own_rows(api, world):
    with api.begin() as c:
        _ctx(c, world["ta"], role="agent")
        assert _addresses(c) == {"A house"}
    with api.begin() as c:
        _ctx(c, world["tb"], role="agent")
        assert _addresses(c) == {"B house"}


def test_supabase_jwt_claims_are_honoured(api, world):
    claims = json.dumps({"sub": str(uuid.uuid4()), "app_metadata": {"tenant_id": str(world["tb"]), "role": "agent"}})
    with api.begin() as c:
        c.execute(text("select set_config('request.jwt.claims', :c, true)"), {"c": claims})
        assert _addresses(c) == {"B house"}


def test_cannot_insert_into_or_move_rows_across_tenants(api, world):
    with pytest.raises(DBAPIError), api.begin() as c:  # WITH CHECK on insert
        _ctx(c, world["ta"], role="admin")
        c.execute(PROP_SQL, {"id": uuid.uuid4(), "t": world["tb"], "addr": "planted"})
    with pytest.raises(DBAPIError), api.begin() as c:  # WITH CHECK on update ("move" my row to B)
        _ctx(c, world["ta"], role="admin")
        c.execute(text("update properties set tenant_id = :b where id = :p"), {"b": world["tb"], "p": world["pa"]})


def test_cannot_update_or_delete_other_tenants_rows(api, world):
    with api.begin() as c:
        _ctx(c, world["ta"], role="admin")
        assert c.execute(text("update properties set list_price = 1 where id = :p"), {"p": world["pb"]}).rowcount == 0
        assert c.execute(text("delete from properties where id = :p"), {"p": world["pb"]}).rowcount == 0
    with api.begin() as c:
        _ctx(c, world["tb"], role="agent")
        assert c.execute(text("select list_price from properties")).scalar_one() == 250000


def test_only_admins_delete(api, world):
    with api.begin() as c:
        _ctx(c, world["ta"], role="agent")
        assert c.execute(text("delete from properties where id = :p"), {"p": world["pa"]}).rowcount == 0
    with api.begin() as c:
        _ctx(c, world["ta"], role="admin")
        assert c.execute(text("delete from properties where id = :p"), {"p": world["pa"]}).rowcount == 1


def test_api_role_cannot_touch_tenants_or_users(api, world):
    with api.begin() as c:
        _ctx(c, world["ta"], role="admin")
        assert c.execute(text("select count(*) from tenants")).scalar_one() == 1  # only its own
    with pytest.raises(DBAPIError), api.begin() as c:
        _ctx(c, world["ta"], role="admin")
        c.execute(text("insert into tenants (name) values ('rogue')"))
    with pytest.raises(DBAPIError), api.begin() as c:
        _ctx(c, world["ta"], role="admin")
        c.execute(text("insert into users (tenant_id, email, password_hash) values (:t, 'x@y.z', 'h')"),
                  {"t": world["ta"]})


# ---- audit trail ----------------------------------------------------------------------
def _audit(admin, record_id):
    with admin.begin() as c:
        return c.execute(
            text("select action, changed_fields, old_data, new_data, changed_by from audit_log "
                 "where record_id = :r order by id"),
            {"r": record_id},
        ).all()


def test_insert_update_delete_are_audited_with_actor(api, admin, world):
    user, pid = uuid.uuid4(), uuid.uuid4()
    with api.begin() as c:
        _ctx(c, world["ta"], user, "admin")
        c.execute(PROP_SQL, {"id": pid, "t": world["ta"], "addr": "Audited"})
    with api.begin() as c:
        _ctx(c, world["ta"], user, "admin")
        c.execute(text("update properties set list_price = 275000, status = 'pending' where id = :p"), {"p": pid})
    with api.begin() as c:
        _ctx(c, world["ta"], user, "admin")
        c.execute(text("delete from properties where id = :p"), {"p": pid})

    rows = _audit(admin, pid)
    assert [r.action for r in rows] == ["INSERT", "UPDATE", "DELETE"]
    assert rows[0].old_data is None and rows[0].new_data["address"] == "Audited"
    assert rows[1].changed_fields == ["list_price", "status"]  # exactly what changed, sorted
    assert float(rows[1].old_data["list_price"]) == 250000 and float(rows[1].new_data["list_price"]) == 275000
    assert rows[2].new_data is None and rows[2].old_data["status"] == "pending"
    assert {r.changed_by for r in rows} == {user}


def test_noop_updates_are_not_audited(api, admin, world):
    with api.begin() as c:
        _ctx(c, world["ta"], role="admin")
        c.execute(text("update properties set list_price = list_price where id = :p"), {"p": world["pa"]})
    assert [r.action for r in _audit(admin, world["pa"])] == ["INSERT"]


def test_audit_log_is_append_only_even_for_superuser(admin, api, world):
    with pytest.raises(DBAPIError, match="append-only"), admin.begin() as c:
        c.execute(text("update audit_log set action = 'DELETE' where record_id = :r"), {"r": world["pa"]})
    with pytest.raises(DBAPIError, match="append-only"), admin.begin() as c:
        c.execute(text("delete from audit_log where record_id = :r"), {"r": world["pa"]})
    with pytest.raises(DBAPIError, match="append-only"), admin.begin() as c:
        c.execute(text("truncate audit_log"))
    # and the API role cannot forge entries at all
    with pytest.raises(DBAPIError), api.begin() as c:
        _ctx(c, world["ta"], role="admin")
        c.execute(
            text("insert into audit_log (table_name, record_id, tenant_id, action) values ('properties', :r, :t, 'INSERT')"),
            {"r": uuid.uuid4(), "t": world["ta"]},
        )


def test_audit_log_visibility_is_admin_and_tenant_scoped(api, world):
    with api.begin() as c:
        _ctx(c, world["ta"], role="admin")
        rows = c.execute(text("select distinct tenant_id from audit_log")).scalars().all()
        assert rows == [world["ta"]]
    with api.begin() as c:
        _ctx(c, world["ta"], role="agent")
        assert c.execute(text("select count(*) from audit_log")).scalar_one() == 0
