"""Load a demo tenant: ~150 listings, a few buyer leads, ready to explore in /docs.

    python -m scripts.seed_demo                       # uses DATABASE_URL / .env
    python -m scripts.seed_demo --email me@x.com --password 'a-long-password'
"""
from __future__ import annotations

import argparse

import numpy as np
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from ml.data import FEATURE_COLUMNS, generate_listings

ZIPS = {"Austin": "78701", "Dallas": "75201", "Denver": "80202", "Phoenix": "85004", "Atlanta": "30303",
        "Seattle": "98101", "Charlotte": "28202", "Nashville": "37203", "Tampa": "33602", "Raleigh": "27601"}
STREETS = ["Oak", "Maple", "Cedar", "Elm", "Pine", "Lakeview", "Sunset", "Willow", "Hickory", "River", "Highland"]
SUFFIX = ["St", "Ave", "Ln", "Dr", "Ct", "Blvd"]
FIRST = ["Sam", "Jordan", "Taylor", "Riley", "Casey", "Morgan", "Avery", "Quinn", "Reese", "Drew"]
LAST = ["Nguyen", "Patel", "Garcia", "Kim", "Johnson", "Okafor", "Rossi", "Cohen", "Silva", "Lee"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", default="demo@example.com")
    ap.add_argument("--password", default="demo-password-123")
    ap.add_argument("--rows", type=int, default=150)
    args = ap.parse_args()

    client = TestClient(create_app(Settings()))
    creds = {"email": args.email, "password": args.password}
    r = client.post("/auth/signup", json={**creds, "company_name": "Demo Realty"})
    if r.status_code == 409:
        r = client.post("/auth/login", json=creds)
    r.raise_for_status()
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    rng = np.random.default_rng(2026)
    homes = generate_listings(args.rows, seed=2026)
    for i, row in homes.iterrows():
        owner = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        body = {c: (row[c].item() if hasattr(row[c], "item") else row[c]) for c in FEATURE_COLUMNS}
        body.update(
            address=f"{int(rng.integers(100, 9900))} {rng.choice(STREETS)} {rng.choice(SUFFIX)}",
            state=row["state"],
            zip_code=ZIPS[row["city"]],
            list_price=float(row["list_price"]),
            owner_name=owner,
            owner_email=f"{owner.lower().replace(' ', '.')}{i}@example.com",
        )
        client.post("/properties", json=body, headers=headers).raise_for_status()

    leads = [
        dict(name="Alex Rivera", email="alex@example.com", budget_min=350_000, budget_max=550_000, min_beds=3,
             preferred_cities=["Austin", "Dallas"], property_types=["single_family"]),
        dict(name="Priya Shah", email="priya@example.com", budget_max=450_000, min_beds=2, min_baths=2,
             preferred_cities=["Denver", "Raleigh"], property_types=["condo", "townhouse"]),
        dict(name="Marcus Bell", email="marcus@example.com", budget_min=700_000, budget_max=1_100_000, min_beds=4,
             preferred_cities=["Seattle"]),
    ]
    for lead in leads:
        client.post("/leads", json=lead, headers=headers).raise_for_status()

    opps = client.get("/opportunities", params={"limit": 3}, headers=headers).json()
    print(f"Seeded {args.rows} properties and {len(leads)} leads for {args.email}")
    for o in opps:
        p = o["property"]
        print(f"  deal: {p['address']}, {p['city']} - {o['discount_pct']:.0%} below model value")
    print("Open http://localhost:8000/docs, click Authorize, and paste a token from POST /auth/login.")


if __name__ == "__main__":
    main()
