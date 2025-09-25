"""E2E: valuation, undervalued-deal discovery, lead recommendations, similar homes."""


def _estimate(client, auth, **kw):
    body = dict(city="Austin", property_type="single_family", beds=3, baths=2.0, sqft=1800,
                lot_sqft=7000, year_built=2005, garage_spaces=2, condition=3)
    body.update(kw)
    r = client.post("/valuation/estimate", json=body, headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


def test_estimate_is_sane(client, auth):
    mid = _estimate(client, auth)
    assert mid["low"] < mid["estimate"] < mid["high"]
    assert mid["warning"] is None and mid["model_version"].startswith("v")
    assert _estimate(client, auth, sqft=3200)["estimate"] > mid["estimate"]
    assert _estimate(client, auth, condition=5)["estimate"] > _estimate(client, auth, condition=1)["estimate"]
    assert _estimate(client, auth, city="Seattle")["estimate"] > _estimate(client, auth, city="Dallas")["estimate"]


def test_estimate_unknown_city_warns_and_bad_input_rejected(client, auth):
    assert _estimate(client, auth, city="Atlantis")["warning"]
    bad = client.post("/valuation/estimate", json={"city": "Austin"}, headers=auth)
    assert bad.status_code == 422
    assert client.post("/valuation/estimate", json={}).status_code == 401


def test_property_valuation_verdicts(client, auth, make_property):
    fair = _estimate(client, auth)["estimate"]
    cheap = make_property(auth, address="1 Cheap St", list_price=round(fair * 0.70))
    pricey = make_property(auth, address="2 Pricey St", list_price=round(fair * 1.40))
    ok = make_property(auth, address="3 Fair St", list_price=round(fair))

    v = client.get(f"/properties/{cheap['id']}/valuation", headers=auth).json()
    assert v["verdict"] == "undervalued" and v["discount_pct"] > 0.15
    assert client.get(f"/properties/{pricey['id']}/valuation", headers=auth).json()["verdict"] == "overpriced"
    assert client.get(f"/properties/{ok['id']}/valuation", headers=auth).json()["verdict"] == "fairly_priced"


def test_opportunities_ranked_by_discount(client, auth, make_property):
    fair = _estimate(client, auth)["estimate"]
    deep = make_property(auth, address="1 Deep Discount", list_price=round(fair * 0.60))
    mild = make_property(auth, address="2 Mild Discount", list_price=round(fair * 0.85))
    make_property(auth, address="3 Fair", list_price=round(fair))
    make_property(auth, address="4 Overpriced", list_price=round(fair * 1.5))
    sold = make_property(auth, address="5 Sold", list_price=round(fair * 0.5))
    client.patch(f"/properties/{sold['id']}", json={"status": "sold"}, headers=auth)

    opps = client.get("/opportunities", headers=auth).json()
    assert [o["property"]["id"] for o in opps] == [deep["id"], mild["id"]]
    assert opps[0]["discount_pct"] > opps[1]["discount_pct"] > 0.08
    assert len(client.get("/opportunities", params={"min_discount": 0.3}, headers=auth).json()) == 1
    assert len(client.get("/opportunities", params={"limit": 1}, headers=auth).json()) == 1


def test_lead_recommendations_respect_preferences(client, auth, make_property):
    fair = _estimate(client, auth)["estimate"]
    match = make_property(auth, address="1 Match Ln", list_price=round(fair * 0.9))
    wrong_city = make_property(auth, address="2 Denver Dr", city="Denver", list_price=round(fair * 0.9))
    too_pricey = make_property(auth, address="3 Mansion Way", list_price=round(fair * 3))
    too_small = make_property(auth, address="4 Tiny Ter", beds=1, sqft=700, list_price=round(fair * 0.3))

    lead = client.post(
        "/leads",
        json={"name": "Pat Buyer", "email": "pat@example.com", "budget_max": round(fair * 1.1),
              "min_beds": 3, "preferred_cities": ["Austin"], "property_types": ["single_family"]},
        headers=auth,
    ).json()
    recs = client.get(f"/leads/{lead['id']}/recommendations", params={"k": 5}, headers=auth).json()

    ids = [r["property"]["id"] for r in recs]
    assert ids[0] == match["id"]
    assert too_pricey["id"] not in ids and too_small["id"] not in ids  # hard filters
    assert wrong_city["id"] in ids and ids.index(wrong_city["id"]) > 0  # soft preference ranks lower
    assert recs[0]["score"] > recs[-1]["score"]
    reasons = " ".join(recs[0]["reasons"])
    assert "within budget" in reasons and "Austin" in reasons and "below model estimate" in reasons


def test_recommendations_empty_without_properties_and_validates_budget(client, auth):
    lead = client.post("/leads", json={"name": "Nil", "email": "nil@example.com"}, headers=auth).json()
    assert client.get(f"/leads/{lead['id']}/recommendations", headers=auth).json() == []
    bad = client.post("/leads", json={"name": "X", "email": "x@example.com", "budget_min": 9, "budget_max": 5}, headers=auth)
    assert bad.status_code == 422


def test_similar_properties(client, auth, make_property):
    base = make_property(auth, address="1 Base St")
    twin = make_property(auth, address="2 Twin St", list_price=510_000)
    other = make_property(auth, address="3 Far Out", city="Seattle", property_type="condo", beds=1, baths=1.0,
                          sqft=650, year_built=1960, list_price=900_000)
    sims = client.get(f"/properties/{base['id']}/similar", params={"k": 5}, headers=auth).json()
    ids = [s["property"]["id"] for s in sims]
    assert base["id"] not in ids  # never itself
    assert ids[0] == twin["id"] and ids[-1] == other["id"]
    assert sims[0]["similarity"] > sims[-1]["similarity"]


def test_model_endpoints(client, auth):
    assert client.get("/health").json()["status"] == "ok"
    info = client.get("/model", headers=auth).json()
    assert info["metrics"]["r2"] > 0.85 and "Austin" in info["cities"]
