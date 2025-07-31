import pytest


@pytest.fixture
def seeded(client, auth, make_property):
    rows = [
        dict(address="1 Oak Ln", city="Austin", beds=3, baths=2.0, sqft=1500, list_price=400_000),
        dict(address="2 Elm St", city="Austin", beds=4, baths=3.0, sqft=2600, list_price=720_000),
        dict(address="3 Pine Rd", city="Denver", beds=2, baths=1.5, sqft=1100, list_price=350_000, property_type="condo"),
        dict(address="4 Oak Ct", city="Denver", beds=5, baths=4.0, sqft=3800, list_price=1_250_000),
        dict(address="5 Bay Blvd", city="Tampa", beds=3, baths=2.0, sqft=1700, list_price=450_000, state="FL"),
    ]
    return auth, [make_property(auth, **r) for r in rows]


def _search(client, headers, **params):
    r = client.get("/properties", params=params, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_filters(client, seeded):
    auth, _ = seeded
    assert _search(client, auth)["total"] == 5
    assert {p["city"] for p in _search(client, auth, city="austin")["items"]} == {"Austin"}
    assert _search(client, auth, state="fl")["total"] == 1
    assert _search(client, auth, property_type="condo")["total"] == 1
    assert _search(client, auth, min_price=400_000, max_price=720_000)["total"] == 3
    assert _search(client, auth, min_beds=4)["total"] == 2
    assert _search(client, auth, min_baths=3)["total"] == 2
    assert _search(client, auth, min_sqft=2000)["total"] == 2
    assert _search(client, auth, q="oak")["total"] == 2
    assert _search(client, auth, city="Denver", min_beds=4)["total"] == 1
    assert _search(client, auth, city="Nowhere")["items"] == []


def test_q_treats_wildcards_literally(client, seeded):
    auth, _ = seeded
    assert _search(client, auth, q="%")["total"] == 0


def test_sorting_and_pagination(client, seeded):
    auth, _ = seeded
    asc = [p["list_price"] for p in _search(client, auth, sort="price_asc")["items"]]
    assert asc == sorted(asc)
    desc = [p["list_price"] for p in _search(client, auth, sort="price_desc")["items"]]
    assert desc == sorted(desc, reverse=True)

    page1 = _search(client, auth, sort="price_asc", limit=2, offset=0)
    page2 = _search(client, auth, sort="price_asc", limit=2, offset=2)
    page3 = _search(client, auth, sort="price_asc", limit=2, offset=4)
    assert page1["total"] == page2["total"] == 5
    ids = [p["id"] for page in (page1, page2, page3) for p in page["items"]]
    assert len(ids) == len(set(ids)) == 5  # no overlap, nothing dropped


def test_param_validation(client, seeded):
    auth, _ = seeded
    assert client.get("/properties", params={"limit": 0}, headers=auth).status_code == 422
    assert client.get("/properties", params={"sort": "random"}, headers=auth).status_code == 422
    assert client.get("/properties", params={"min_price": -1}, headers=auth).status_code == 422


def test_update_and_status_filter(client, seeded):
    auth, rows = seeded
    pid = rows[0]["id"]
    r = client.patch(f"/properties/{pid}", json={"status": "sold", "list_price": 410_000}, headers=auth)
    assert r.status_code == 200 and r.json()["status"] == "sold" and r.json()["list_price"] == 410_000
    assert _search(client, auth, status="sold")["total"] == 1
    assert _search(client, auth, status="active")["total"] == 4
