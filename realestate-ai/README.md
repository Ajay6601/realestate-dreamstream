# Realestate AI Outreach

A multi-tenant real-estate outreach platform with three AI features that make the outreach worth reading:

| Feature | What it does | Where |
|---|---|---|
| **Price prediction** | Gradient-boosted model estimates a home's value with an 80% interval. Compare to the asking price to flag **undervalued** or **overpriced** listings. | `ml/`, `GET /properties/{id}/valuation`, `GET /opportunities` |
| **Property recommendation** | Explainable lead-to-property matching (budget, location, type, *value*, similarity to homes the lead liked) and "similar homes". | `ml/recommender.py`, `GET /leads/{id}/recommendations` |
| **Outreach drafting** | Drafts grounded in the model's numbers: pitch an owner on repricing, or pitch a buyer a match with the reasons it fits. Optional LLM polish with guardrails; every draft carries an opt-out line and postal address. | `app/services/outreach.py`, `POST /outreach/draft`, `/outreach/bulk-draft` |

Agent workflow: load listings and leads, run `/opportunities` to find mispriced homes, `/outreach/bulk-draft` to draft messages, review or edit, then `mark-sent`.

## What's engineered here

- **ML pipeline** (`python -m ml.pipeline run`): synthetic data (or your CSV) -> derived features (inside the sklearn pipeline, so train and inference can't drift) -> train -> **validation gates** -> promote. Gates: R2, MAPE, beats a naive city $/sqft baseline, finite and monotonic predictions, interval calibration, no regression against the current champion. A failing gate exits 1 and never moves the `latest` pointer. `rollback` restores the previous version.
- **Row-Level Security + audit triggers** (`sql/`): every tenant table is isolated at the database (`FORCE ROW LEVEL SECURITY`, `WITH CHECK` blocks cross-tenant writes, only admins delete). A trigger records insert/update/delete with before/after images, the exact changed fields, and the actor. The audit log is append-only even for the table owner. Works with Supabase JWT claims *or* session settings set by the API.
- **Tests**: ML unit tests, recommender tests, e2e API workflows (auth, tenancy and roles, search, valuation, recommendations, the full outreach journey), and database tests that talk to Postgres as the unprivileged role. Postgres tests are mutation-checked: weakening a policy or trigger turns them red.
- **CI/CD** (`.github/workflows/`): lint, tests on SQLite (py3.10/3.12), the same e2e suite on a Postgres service container plus RLS/audit tests, a model gate, image build and push to GHCR, a gated deploy hook with a smoke test, and a weekly retrain workflow.

## Quick start (no database needed)

```bash
pip install -r requirements-dev.txt
python -m scripts.seed_demo            # demo tenant: 150 listings, 3 leads
uvicorn app.main:create_app --factory --reload
```

Open http://localhost:8000/docs, call `POST /auth/login` (`demo@example.com` / `demo-password-123`), then use **Authorize**. The first start trains a small model if none is promoted yet.

## Full stack with Postgres (RLS + audit active)

```bash
docker compose up --build
```

Postgres is published on host port 55432. The API connects as `app_user`, which is subject to RLS. The owner connection (`ADMIN_DATABASE_URL`) is used only for signup and login, which run before a tenant exists. On Supabase, point `ADMIN_DATABASE_URL` at the service role and grant to `authenticated` in `sql/004_grants.sql`.

## Tests

```bash
pytest                                 # ML + e2e on in-memory SQLite
# same suite on Postgres, plus RLS and audit tests:
export TEST_ADMIN_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:55432/realestate
export TEST_DATABASE_URL=postgresql+psycopg://app_user:app_user_pw@localhost:55432/realestate
pytest
```

## Using real data

```bash
python -m ml.pipeline run --data sales.csv   # columns: city, property_type, beds, baths, sqft, lot_sqft,
                                             #          year_built, garage_spaces, condition, sale_price
```

The bundled model trains on **synthetic** data, so its numbers show the pipeline works but say nothing about any real market. Train on real sales before trusting estimates, and treat the interval as the honest statement of uncertainty.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./data/app.db` | Postgres: `postgresql+psycopg://...` as the RLS-bound role |
| `ADMIN_DATABASE_URL` | same as above | Owner or `BYPASSRLS` role, signup and login only |
| `JWT_SECRET` | dev value | **Required** when `ENVIRONMENT=prod` |
| `MODEL_REGISTRY_DIR` | `artifacts/price_model` | |
| `AUTO_BOOTSTRAP_MODEL` | `true` | Train a small model on first start if none is promoted |
| `ANTHROPIC_API_KEY` | unset | Enables LLM polish of drafts. It is rejected and the template used if figures or the opt-out footer change |
| `SENDER_NAME`, `SENDER_COMPANY`, `SENDER_ADDRESS` | placeholders | Appear in every draft (CAN-SPAM needs a real postal address) |

## Limits to know about

- `mark-sent` records that a person sent the message; it does not deliver email. Plug an SMTP or ESP client in there, and honor `STOP` replies.
- Recommendations and opportunities score all of a tenant's listings per request. That is fine for thousands of rows; cache or precompute beyond that.
- The audit endpoint reads trigger-written rows, so it is empty on SQLite.
