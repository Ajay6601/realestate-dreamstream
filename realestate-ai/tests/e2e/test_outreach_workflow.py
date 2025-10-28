"""E2E: the full agent journey - load listings, find deals, draft outreach, review, send."""


def _fair(client, auth):
    r = client.post(
        "/valuation/estimate",
        json=dict(city="Austin", property_type="single_family", beds=3, baths=2.0, sqft=1800,
                  lot_sqft=7000, year_built=2005, garage_spaces=2, condition=3),
        headers=auth,
    )
    return r.json()["estimate"]


def test_owner_outreach_draft_is_grounded_and_compliant(client, auth, make_property):
    fair = _fair(client, auth)
    prop = make_property(auth, address="12 Hidden Gem Rd", list_price=round(fair * 0.7))
    r = client.post("/outreach/draft", json={"property_id": prop["id"]}, headers=auth)
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["status"] == "draft" and d["audience"] == "owner" and d["generated_by"] == "template"
    assert d["recipient_email"] == "dana@example.com"
    assert "12 Hidden Gem Rd" in d["subject"] and d["body"].startswith("Hi Dana,")
    assert f"${round(fair * 0.7):,}" in d["body"]  # cites the price on record
    assert "above the" in d["body"] and "repricing" in d["body"]  # undervalued -> upside pitch
    assert "Reply STOP" in d["body"] and "123 Main St" in d["body"]  # opt-out + postal address


def test_overpriced_owner_gets_different_message(client, auth, make_property):
    fair = _fair(client, auth)
    prop = make_property(auth, list_price=round(fair * 1.5))
    body = client.post("/outreach/draft", json={"property_id": prop["id"]}, headers=auth).json()["body"]
    assert "above market" in body and "repricing" not in body


def test_owner_draft_requires_owner_email(client, auth, make_property):
    prop = make_property(auth, owner_email=None)
    r = client.post("/outreach/draft", json={"property_id": prop["id"]}, headers=auth)
    assert r.status_code == 422


def test_lead_pitch_cites_match_reasons(client, auth, make_property):
    fair = _fair(client, auth)
    prop = make_property(auth, address="7 Lakeview Dr", list_price=round(fair * 0.85))
    lead = client.post(
        "/leads",
        json={"name": "Robin Hart", "email": "robin@example.com", "budget_max": round(fair),
              "preferred_cities": ["Austin"]},
        headers=auth,
    ).json()
    d = client.post("/outreach/draft", json={"property_id": prop["id"], "lead_id": lead["id"]}, headers=auth).json()
    assert d["audience"] == "lead" and d["recipient_email"] == "robin@example.com"
    assert d["body"].startswith("Hi Robin,") and "Why it fits" in d["body"]
    assert "Within budget" in d["body"] and "below" in d["body"]


def test_edit_then_mark_sent_lifecycle(client, auth, make_property):
    prop = make_property(auth)
    d = client.post("/outreach/draft", json={"property_id": prop["id"]}, headers=auth).json()

    edited = client.patch(f"/outreach/{d['id']}", json={"subject": "Quick question"}, headers=auth)
    assert edited.status_code == 200 and edited.json()["subject"] == "Quick question"

    sent = client.post(f"/outreach/{d['id']}/mark-sent", headers=auth)
    assert sent.status_code == 200 and sent.json()["status"] == "sent" and sent.json()["sent_at"]
    assert client.post(f"/outreach/{d['id']}/mark-sent", headers=auth).status_code == 409
    assert client.patch(f"/outreach/{d['id']}", json={"subject": "Too late"}, headers=auth).status_code == 409

    assert len(client.get("/outreach", params={"status": "sent"}, headers=auth).json()) == 1
    assert client.get("/outreach", params={"status": "draft"}, headers=auth).json() == []


def test_full_agent_journey_with_bulk_drafts(client, auth, make_property):
    fair = _fair(client, auth)
    deals = [
        make_property(auth, address=f"{n} Bargain St", list_price=round(fair * f), owner_email=f"o{n}@example.com")
        for n, f in ((1, 0.60), (2, 0.75))
    ]
    make_property(auth, address="3 Fair St", list_price=round(fair), owner_email="o3@example.com")
    make_property(auth, address="4 Silent Deal", list_price=round(fair * 0.6), owner_email=None)

    # find deals
    opps = client.get("/opportunities", headers=auth).json()
    assert len(opps) == 3  # includes the deal with no contact info

    # bulk-draft: skips the one without an owner email, ignores fairly priced
    r = client.post("/outreach/bulk-draft", headers=auth).json()
    assert r["created"] == 2 and r["skipped"] == 1
    assert {d["property_id"] for d in r["drafts"]} == {p["id"] for p in deals}

    # idempotent: a second run doesn't double-contact owners
    again = client.post("/outreach/bulk-draft", headers=auth).json()
    assert again["created"] == 0

    # review + send the first draft
    first = r["drafts"][0]
    assert client.post(f"/outreach/{first['id']}/mark-sent", headers=auth).status_code == 200
    drafts = client.get("/outreach", params={"status": "draft"}, headers=auth).json()
    assert len(drafts) == 1 and drafts[0]["id"] != first["id"]


def test_llm_output_is_rejected_when_it_drops_figures_or_footer():
    from app.config import Settings
    from app.services.outreach import _llm_ok

    s = Settings(environment="test")
    original = f"Worth $450,000. Range $400,000-$500,000.\n--\n{s.sender_address}\nReply STOP to opt out."
    good = f"Hello! Worth $450,000, range $400,000-$500,000.\n{s.sender_address}\nReply STOP."
    assert _llm_ok(original, good, s)
    assert not _llm_ok(original, good.replace("$450,000", "$999,000"), s)  # changed a figure
    assert not _llm_ok(original, good.replace("STOP", "").replace(s.sender_address, ""), s)  # lost footer
