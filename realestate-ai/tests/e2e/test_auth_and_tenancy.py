import uuid

from tests.conftest import PROPERTY


def test_signup_login_and_token_checks(client):
    email = f"owner-{uuid.uuid4().hex[:8]}@example.com"
    body = {"email": email, "password": "correct-horse", "company_name": "Acme"}
    assert client.post("/auth/signup", json=body).status_code == 201
    assert client.post("/auth/signup", json=body).status_code == 409  # duplicate

    ok = client.post("/auth/login", json={"email": email.upper(), "password": "correct-horse"})
    assert ok.status_code == 200 and ok.json()["role"] == "admin"
    bad = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
    assert bad.status_code == 401
    assert client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever1"}).status_code == 401

    assert client.get("/properties").status_code == 401
    assert client.get("/properties", headers={"Authorization": "Bearer not-a-token"}).status_code == 401
    good = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    assert client.get("/properties", headers=good).status_code == 200


def test_signup_validation(client):
    r = client.post("/auth/signup", json={"email": "not-an-email", "password": "short", "company_name": " "})
    assert r.status_code == 422


def test_tenants_cannot_see_or_touch_each_other(client, signup, make_property):
    a, b = signup("Tenant A"), signup("Tenant B")
    prop = make_property(a, address="1 Secret Way")
    lead = client.post("/leads", json={"name": "Lee", "email": "lee@example.com"}, headers=a).json()

    # B's views are empty
    assert client.get("/properties", headers=b).json()["total"] == 0
    assert client.get("/leads", headers=b).json() == []
    assert client.get("/opportunities", headers=b).json() == []
    assert client.get("/outreach", headers=b).json() == []

    # direct access by id is a 404 (not 403: don't confirm existence)
    pid, lid = prop["id"], lead["id"]
    assert client.get(f"/properties/{pid}", headers=b).status_code == 404
    assert client.patch(f"/properties/{pid}", json={"list_price": 1}, headers=b).status_code == 404
    assert client.delete(f"/properties/{pid}", headers=b).status_code == 404
    assert client.get(f"/properties/{pid}/valuation", headers=b).status_code == 404
    assert client.get(f"/properties/{pid}/similar", headers=b).status_code == 404
    assert client.get(f"/leads/{lid}", headers=b).status_code == 404
    assert client.get(f"/leads/{lid}/recommendations", headers=b).status_code == 404
    assert client.post("/outreach/draft", json={"property_id": pid}, headers=b).status_code == 404
    # B cannot point its own outreach at A's lead either
    own = make_property(b)
    assert client.post("/outreach/draft", json={"property_id": own["id"], "lead_id": lid}, headers=b).status_code == 404

    # A is untouched
    assert client.get(f"/properties/{pid}", headers=a).json()["address"] == "1 Secret Way"


def test_roles_agent_can_work_but_not_delete_or_audit(client, auth, make_property):
    email = f"agent-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/users", json={"email": email, "password": "agent-pass-1", "role": "agent"}, headers=auth)
    assert r.status_code == 201 and r.json()["role"] == "agent"
    token = client.post("/auth/login", json={"email": email, "password": "agent-pass-1"}).json()["access_token"]
    agent = {"Authorization": f"Bearer {token}"}

    prop = make_property(agent, address="9 Agent Ave")  # agents can create...
    assert client.patch(f"/properties/{prop['id']}", json={"status": "pending"}, headers=agent).status_code == 200
    assert client.delete(f"/properties/{prop['id']}", headers=agent).status_code == 403  # ...not delete
    assert client.get("/audit", headers=agent).status_code == 403
    assert client.post("/auth/users", json={"email": "x@example.com", "password": "password-1"}, headers=agent).status_code == 403

    # same tenant: the admin sees the agent's property and can delete it
    assert client.get(f"/properties/{prop['id']}", headers=auth).status_code == 200
    assert client.delete(f"/properties/{prop['id']}", headers=auth).status_code == 204


def test_property_input_validation(client, auth):
    for bad in (
        {**PROPERTY, "list_price": -5},
        {**PROPERTY, "zip_code": "ABCDE"},
        {**PROPERTY, "property_type": "castle"},
        {**PROPERTY, "owner_email": "nope"},
        {**PROPERTY, "beds": 99},
    ):
        assert client.post("/properties", json=bad, headers=auth).status_code == 422
