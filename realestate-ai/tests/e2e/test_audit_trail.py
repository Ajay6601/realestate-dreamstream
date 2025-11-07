"""Audit trail through the HTTP API (Postgres only - rows are written by DB triggers)."""
from app.security import decode_token
from tests.conftest import requires_postgres

pytestmark = requires_postgres


def test_changes_show_up_in_audit_endpoint_with_actor(client, signup, make_property, settings):
    admin = signup("Audit Co")
    actor = decode_token(settings.jwt_secret, admin["Authorization"].split()[1])["sub"]

    prop = make_property(admin, address="1 Audit Ave")
    client.patch(f"/properties/{prop['id']}", json={"list_price": 123_456}, headers=admin)
    client.delete(f"/properties/{prop['id']}", headers=admin)

    trail = client.get("/audit", params={"record_id": prop["id"]}, headers=admin).json()
    assert [e["action"] for e in trail] == ["DELETE", "UPDATE", "INSERT"]  # newest first
    update = trail[1]
    assert update["changed_fields"] == ["list_price"] and update["changed_by"] == actor
    assert float(update["new_data"]["list_price"]) == 123_456

    other = signup("Someone Else")
    assert client.get("/audit", headers=other).json() == []  # tenants never see each other's history

