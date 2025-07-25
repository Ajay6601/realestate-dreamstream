"""Shared fixtures.

By default the suite runs against in-memory SQLite. Set TEST_DATABASE_URL (the RLS-bound
app role) and TEST_ADMIN_DATABASE_URL (superuser / BYPASSRLS) to run the *same* e2e tests
against Postgres, which also enables the audit-trail and RLS tests.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.config import Settings
from app.main import create_app
from ml.pipeline import run_pipeline
from ml.registry import ModelRegistry

PG_URL = os.getenv("TEST_DATABASE_URL")
PG_ADMIN_URL = os.getenv("TEST_ADMIN_DATABASE_URL")
HAS_POSTGRES = bool(PG_URL and PG_ADMIN_URL)

requires_postgres = pytest.mark.skipif(not HAS_POSTGRES, reason="set TEST_DATABASE_URL + TEST_ADMIN_DATABASE_URL")


SQL_DIR = Path(__file__).resolve().parent.parent / "sql"
APP_ROLE_PASSWORD = "app_user_pw"


def apply_migrations(admin_url: str) -> None:
    """Idempotently apply sql/*.sql as the owner/superuser, then let the API role log in."""
    engine = create_engine(admin_url)
    raw = engine.raw_connection()
    try:
        cur = raw.cursor()
        for f in sorted(SQL_DIR.glob("*.sql")):
            cur.execute(f.read_text(encoding="utf-8"))  # no params: '%' in format() calls is literal
            if f.name.startswith("000"):
                cur.execute(f"ALTER ROLE app_user LOGIN PASSWORD '{APP_ROLE_PASSWORD}'")
        raw.commit()
    finally:
        raw.close()
        engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _postgres_schema():
    if HAS_POSTGRES:
        apply_migrations(PG_ADMIN_URL)


@pytest.fixture(scope="session")
def registry_dir(tmp_path_factory) -> str:
    path = tmp_path_factory.mktemp("registry")
    out = run_pipeline(ModelRegistry(path), rows=3000, seed=11)
    assert out["promoted"], out["validation"]
    return str(path)


@pytest.fixture
def settings(registry_dir) -> Settings:
    return Settings(
        environment="test",
        database_url=PG_URL if HAS_POSTGRES else "sqlite://",
        admin_database_url=PG_ADMIN_URL if HAS_POSTGRES else None,
        jwt_secret="test-secret-test-secret-test-secret-123",
        model_registry_dir=registry_dir,
        auto_bootstrap_model=False,
        anthropic_api_key=None,
    )


@pytest.fixture
def client(settings) -> TestClient:
    return TestClient(create_app(settings))


def _email() -> str:
    return f"user-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def signup(client):
    """Factory: create a tenant + admin and return its auth headers."""

    def _signup(company: str = "Acme Realty") -> dict:
        email = _email()
        r = client.post("/auth/signup", json={"email": email, "password": "correct-horse", "company_name": company})
        assert r.status_code == 201, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _signup


@pytest.fixture
def auth(signup) -> dict:
    return signup()


PROPERTY = {
    "address": "100 Main St",
    "city": "Austin",
    "state": "TX",
    "zip_code": "78701",
    "property_type": "single_family",
    "beds": 3,
    "baths": 2.0,
    "sqft": 1800,
    "lot_sqft": 7000,
    "year_built": 2005,
    "garage_spaces": 2,
    "condition": 3,
    "list_price": 500000,
    "owner_name": "Dana Smith",
    "owner_email": "dana@example.com",
}


@pytest.fixture
def make_property(client):
    def _make(headers: dict, **overrides) -> dict:
        r = client.post("/properties", json={**PROPERTY, **overrides}, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    return _make

