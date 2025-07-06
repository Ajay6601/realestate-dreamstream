# Illustrative build progression: 7 Jul 2025 to 18 May 2026

> **This is a planning model, not a record.** All of this code was actually written in a single session. The dates below show how the same work would realistically unfold across 23 two-week sprints, in dependency order (schema before RLS, RLS before audit, model before API, tests with each feature). Do not present it as real commit history, and do not backdate commits to match it.

**125 commits over 46 weeks** (45 active weeks), avg 2.7 per week; busiest week 4, quiet weeks around Labor Day, Thanksgiving and year-end.

Workflow files: `ci.yml` = `.github/workflows/ci.yml`; `model-retrain.yml` = `.github/workflows/model-retrain.yml`.

## Phase overview

| Sprint | Dates | Theme | Commits |
|---|---|---|---|
| S1 | 07 Jul - 18 Jul 2025 | Foundation | 6 |
| S2 | 21 Jul - 01 Aug 2025 | Auth + properties | 8 |
| S3 | 04 Aug - 15 Aug 2025 | Tenancy, roles, leads | 5 |
| S4 | 18 Aug - 29 Aug 2025 | ML v1 | 6 |
| S5 | 01 Sep - 12 Sep 2025 | Validation gates | 6 |
| S6 | 15 Sep - 26 Sep 2025 | Valuation API | 6 |
| S7 | 29 Sep - 10 Oct 2025 | Recommender | 6 |
| S8 | 13 Oct - 24 Oct 2025 | Outreach drafting | 6 |
| S9 | 27 Oct - 07 Nov 2025 | Outreach polish | 5 |
| S10 | 10 Nov - 21 Nov 2025 | Row-Level Security | 6 |
| S11 | 24 Nov - 05 Dec 2025 | RLS tests + audit start | 4 |
| S12 | 08 Dec - 19 Dec 2025 | Audit trail | 6 |
| S13 | 22 Dec - 02 Jan 2026 | Holiday cooldown | 2 |
| S14 | 05 Jan - 16 Jan 2026 | CI | 5 |
| S15 | 19 Jan - 30 Jan 2026 | Containers + CD | 6 |
| S16 | 02 Feb - 13 Feb 2026 | Hardening | 6 |
| S17 | 16 Feb - 27 Feb 2026 | Demo + real-data path | 5 |
| S18 | 02 Mar - 13 Mar 2026 | Recommender perf | 5 |
| S19 | 16 Mar - 27 Mar 2026 | CI hardening | 5 |
| S20 | 30 Mar - 10 Apr 2026 | Gate tuning + outreach edges | 6 |
| S21 | 13 Apr - 24 Apr 2026 | Docs + audit coverage | 5 |
| S22 | 27 Apr - 08 May 2026 | Verification | 6 |
| S23 | 11 May - 18 May 2026 | Release | 4 |

## Sprint 1: Foundation  (07 Jul - 18 Jul 2025)

_Goal: Repo, config, DB layer, first schema_

| Date | Commit | Files |
|---|---|---|
| Mon 07 Jul 2025 | chore: scaffold repo, pytest/ruff config, gitignore | `pyproject.toml, .gitignore, requirements.txt, requirements-dev.txt` |
| Wed 09 Jul 2025 | feat(api): FastAPI app factory + /health | `app/main.py, app/routes/system.py` |
| Fri 11 Jul 2025 | feat(config): env-driven settings (DB url, JWT secret) | `app/config.py` |
| Tue 15 Jul 2025 | feat(db): engine factory for SQLite dev / Postgres | `app/db.py` |
| Wed 16 Jul 2025 | feat(models): tenants, users, properties ORM models | `app/models.py` |
| Fri 18 Jul 2025 | feat(sql): 001 schema - tables, indexes, CHECK constraints | `sql/001_schema.sql` |

## Sprint 2: Auth + properties  (21 Jul - 01 Aug 2025)

_Goal: Signup/login, JWT, tenant-scoped property CRUD + search_

| Date | Commit | Files |
|---|---|---|
| Mon 21 Jul 2025 | feat(auth): PBKDF2 password hashing + JWT helpers | `app/security.py` |
| Tue 22 Jul 2025 | feat(auth): signup/login, one tenant per signup | `app/routes/auth.py, app/schemas.py` |
| Thu 24 Jul 2025 | feat(deps): bearer principal, tenant-scoped session, admin guard | `app/deps.py` |
| Fri 25 Jul 2025 | test: pytest harness, in-memory SQLite app + signup fixtures | `tests/conftest.py` |
| Mon 28 Jul 2025 | feat(properties): create/get/patch/delete with tenant filter | `app/routes/properties.py` |
| Wed 30 Jul 2025 | feat(properties): search filters, sort whitelist, pagination | `app/routes/properties.py, app/schemas.py` |
| Thu 31 Jul 2025 | test(e2e): search, sorting, pagination | `tests/e2e/test_property_search.py` |
| Fri 01 Aug 2025 | fix(search): treat % and _ in address query literally | `app/routes/properties.py, tests/e2e/test_property_search.py` |

## Sprint 3: Tenancy, roles, leads  (04 Aug - 15 Aug 2025)

_Goal: Cross-tenant tests, agent/admin roles, leads_

| Date | Commit | Files |
|---|---|---|
| Tue 05 Aug 2025 | test(e2e): auth flow, cross-tenant 404s | `tests/e2e/test_auth_and_tenancy.py` |
| Thu 07 Aug 2025 | feat(auth): admin-only POST /auth/users, agent role | `app/routes/auth.py, app/schemas.py` |
| Fri 08 Aug 2025 | feat(leads): leads table + CRUD | `app/models.py, app/routes/leads.py, sql/001_schema.sql` |
| Mon 11 Aug 2025 | test(e2e): agent can work but not delete/audit | `tests/e2e/test_auth_and_tenancy.py` |
| Wed 13 Aug 2025 | feat(leads): validate budget_min <= budget_max | `app/routes/leads.py, app/schemas.py` |

## Sprint 4: ML v1  (18 Aug - 29 Aug 2025)

_Goal: Data generator, features, training, registry, inference_

| Date | Commit | Files |
|---|---|---|
| Mon 18 Aug 2025 | ml: synthetic listing generator (city/type/age/condition pricing) | `ml/data.py` |
| Wed 20 Aug 2025 | ml: derived features inside the sklearn pipeline | `ml/features.py` |
| Fri 22 Aug 2025 | ml: train candidate, holdout metrics, naive $/sqft baseline | `ml/train.py` |
| Tue 26 Aug 2025 | ml: file registry with promote pointer + rollback | `ml/registry.py` |
| Thu 28 Aug 2025 | ml: PricePredictor with 80% residual interval | `ml/inference.py` |
| Fri 29 Aug 2025 | test(ml): generator determinism, schema guard, interval coverage | `tests/ml/test_pipeline.py` |

## Sprint 5: Validation gates  (01 Sep - 12 Sep 2025)

_Goal: Promotion gates, pipeline CLI, rollback_

| Date | Commit | Files |
|---|---|---|
| Wed 03 Sep 2025 | ml: validation gates (R2, MAPE, within-10%, baseline gain) | `ml/validate.py` |
| Fri 05 Sep 2025 | ml: monotonic-in-sqft + finite/positive prediction checks | `ml/validate.py` |
| Mon 08 Sep 2025 | ml: champion-regression + interval-calibration gates | `ml/validate.py` |
| Wed 10 Sep 2025 | ml: pipeline CLI run/status/rollback, exit 1 on failed gate | `ml/pipeline.py` |
| Thu 11 Sep 2025 | test(ml): bad candidate not promoted, garbage labels fail, rollback | `tests/ml/test_pipeline.py` |
| Fri 12 Sep 2025 | tune: HistGradientBoosting params, log-target | `ml/features.py` |

## Sprint 6: Valuation API  (15 Sep - 26 Sep 2025)

_Goal: Estimates, verdicts, undervalued-deal discovery_

| Date | Commit | Files |
|---|---|---|
| Mon 15 Sep 2025 | feat(api): load promoted model at startup, bootstrap if empty | `app/main.py, app/config.py` |
| Wed 17 Sep 2025 | feat(valuation): POST /valuation/estimate | `app/routes/insights.py, app/schemas.py, app/deps.py` |
| Fri 19 Sep 2025 | feat(valuation): per-property valuation + verdict | `app/services/valuation.py, app/routes/insights.py` |
| Tue 23 Sep 2025 | feat(opportunities): undervalued listings ranked by discount | `app/routes/insights.py` |
| Thu 25 Sep 2025 | test(e2e): estimate sanity, verdicts, opportunity ordering | `tests/e2e/test_ai_features.py` |
| Fri 26 Sep 2025 | feat(ml): warn on unseen city/property type | `ml/inference.py, app/schemas.py` |

## Sprint 7: Recommender  (29 Sep - 10 Oct 2025)

_Goal: Lead matching, similar homes, explainable reasons_

| Date | Commit | Files |
|---|---|---|
| Mon 29 Sep 2025 | ml: item-item cosine similarity | `ml/recommender.py` |
| Wed 01 Oct 2025 | ml: lead scoring (budget/location/type/value) + hard filters | `ml/recommender.py` |
| Fri 03 Oct 2025 | test(ml): hard filters, value tie-break, inactive excluded | `tests/ml/test_recommender.py` |
| Tue 07 Oct 2025 | feat(recs): GET /leads/{id}/recommendations | `app/routes/insights.py` |
| Thu 09 Oct 2025 | feat(recs): GET /properties/{id}/similar | `app/routes/insights.py` |
| Fri 10 Oct 2025 | ml: liked-property centroid boost + readable reasons | `ml/recommender.py` |

## Sprint 8: Outreach drafting  (13 Oct - 24 Oct 2025)

_Goal: Owner/lead drafts, lifecycle, bulk drafts_

| Date | Commit | Files |
|---|---|---|
| Mon 13 Oct 2025 | test(e2e): recommendations respect preferences, similar homes | `tests/e2e/test_ai_features.py` |
| Tue 14 Oct 2025 | feat(outreach): outreach_messages table + model | `app/models.py, sql/001_schema.sql` |
| Thu 16 Oct 2025 | feat(outreach): template drafts (owner/lead) with opt-out footer | `app/services/outreach.py` |
| Mon 20 Oct 2025 | feat(outreach): POST /outreach/draft | `app/routes/outreach.py, app/schemas.py` |
| Wed 22 Oct 2025 | feat(outreach): edit draft + mark-sent lifecycle | `app/routes/outreach.py` |
| Fri 24 Oct 2025 | feat(outreach): bulk-draft top opportunities, idempotent | `app/routes/outreach.py` |

## Sprint 9: Outreach polish  (27 Oct - 07 Nov 2025)

_Goal: LLM guardrails, fixes_

| Date | Commit | Files |
|---|---|---|
| Tue 28 Oct 2025 | test(e2e): drafts, lifecycle, full agent journey | `tests/e2e/test_outreach_workflow.py` |
| Thu 30 Oct 2025 | feat(outreach): optional LLM polish with figure+footer guardrails | `app/services/outreach.py, app/config.py` |
| Mon 03 Nov 2025 | fix(outreach): money regex dropped trailing commas | `app/services/outreach.py, tests/e2e/test_outreach_workflow.py` |
| Wed 05 Nov 2025 | feat(outreach): lead pitch reuses recommender reasons | `app/routes/outreach.py` |
| Fri 07 Nov 2025 | chore: ruff cleanup pass | `app/, ml/, tests/` |

## Sprint 10: Row-Level Security  (10 Nov - 21 Nov 2025)

_Goal: Policies, grants, per-transaction context_

| Date | Commit | Files |
|---|---|---|
| Mon 10 Nov 2025 | sql: 002 RLS helper functions (JWT claims or session GUCs) | `sql/002_rls.sql` |
| Wed 12 Nov 2025 | sql: tenant policies, FORCE RLS, WITH CHECK, admin-only delete | `sql/002_rls.sql` |
| Thu 13 Nov 2025 | sql: 000 roles + 004 least-privilege grants | `sql/000_roles.sql, sql/004_grants.sql` |
| Tue 18 Nov 2025 | feat(db): bind RLS context per request | `app/db.py, app/deps.py` |
| Wed 19 Nov 2025 | fix(db): re-apply set_config each transaction (after_begin); commit dropped tenant | `app/db.py` |
| Fri 21 Nov 2025 | feat(auth): separate admin engine for signup/login | `app/main.py, app/deps.py, app/config.py` |

## Sprint 11: RLS tests + audit start  (24 Nov - 05 Dec 2025)

_Goal: Postgres tests; trigger function (Thanksgiving week light)_

| Date | Commit | Files |
|---|---|---|
| Mon 24 Nov 2025 | test(db): Postgres fixtures, idempotent migration apply | `tests/conftest.py` |
| Wed 26 Nov 2025 | test(db): isolation - no context sees nothing, cross-tenant writes blocked | `tests/db/test_rls_and_audit.py` |
| Tue 02 Dec 2025 | test(db): admin-only delete, read-only tenants/users, Supabase claims | `tests/db/test_rls_and_audit.py` |
| Thu 04 Dec 2025 | sql: 003 audit trigger function (SECURITY DEFINER) + triggers | `sql/003_audit.sql` |

## Sprint 12: Audit trail  (08 Dec - 19 Dec 2025)

_Goal: Diffing, append-only log, /audit, tests_

| Date | Commit | Files |
|---|---|---|
| Mon 08 Dec 2025 | sql: audit changed_fields diff; skip no-op / updated_at-only | `sql/003_audit.sql` |
| Wed 10 Dec 2025 | sql: append-only audit_log (update/delete/truncate blocked) | `sql/003_audit.sql` |
| Fri 12 Dec 2025 | feat(api): GET /audit (admin) with table/record filters | `app/routes/system.py, app/models.py, app/schemas.py` |
| Tue 16 Dec 2025 | test(db): audit actor, no-op, append-only, visibility | `tests/db/test_rls_and_audit.py` |
| Thu 18 Dec 2025 | test(e2e): audit trail via API on Postgres | `tests/e2e/test_audit_trail.py` |
| Fri 19 Dec 2025 | test: mutation-check RLS/audit (weaken policy -> red) | `tests/db/test_rls_and_audit.py` |

## Sprint 13: Holiday cooldown  (22 Dec - 02 Jan 2026)

_Goal: Light maintenance_

| Date | Commit | Files |
|---|---|---|
| Wed 24 Dec 2025 | chore: pin dependency floors | `requirements.txt, requirements-dev.txt` |
| Fri 26 Dec 2025 | docs: SQL header notes on policy intent | `sql/002_rls.sql, sql/003_audit.sql` |

## Sprint 14: CI  (05 Jan - 16 Jan 2026)

_Goal: Lint, matrix, Postgres service, model gate_

| Date | Commit | Files |
|---|---|---|
| Mon 05 Jan 2026 | ci: lint job (ruff) | `ci.yml` |
| Wed 07 Jan 2026 | ci: pytest on SQLite, py3.10 + 3.12 matrix | `ci.yml` |
| Fri 09 Jan 2026 | ci: Postgres service container job (e2e + tests/db) | `ci.yml` |
| Tue 13 Jan 2026 | fix(ci): app_user login in conftest, wait for pg health | `ci.yml, tests/conftest.py` |
| Thu 15 Jan 2026 | ci: model-gate job - retrain, validate, upload registry | `ci.yml, ml/pipeline.py` |

## Sprint 15: Containers + CD  (19 Jan - 30 Jan 2026)

_Goal: Docker, compose, GHCR, gated deploy, retrain schedule_

| Date | Commit | Files |
|---|---|---|
| Mon 19 Jan 2026 | build: Dockerfile (non-root, healthcheck) | `Dockerfile, .dockerignore` |
| Wed 21 Jan 2026 | build: docker-compose with initdb SQL + app_user | `docker-compose.yml, sql/005_dev_login.sh` |
| Fri 23 Jan 2026 | ci: build and push image to GHCR (sha/tag metadata) | `ci.yml` |
| Tue 27 Jan 2026 | ci: gated deploy job + smoke test | `ci.yml` |
| Thu 29 Jan 2026 | ci: weekly scheduled retrain workflow | `model-retrain.yml` |
| Fri 30 Jan 2026 | fix(jwt): longer dev secret, silence key-length warning | `app/config.py, tests/conftest.py` |

## Sprint 16: Hardening  (02 Feb - 13 Feb 2026)

_Goal: Validation, timing, prod-secret guard_

| Date | Commit | Files |
|---|---|---|
| Mon 02 Feb 2026 | fix(config): protected_namespaces warning on model_registry_dir | `app/config.py` |
| Wed 04 Feb 2026 | fix(validation): zip/state/email constraints on PropertyIn | `app/schemas.py` |
| Fri 06 Feb 2026 | test(e2e): input validation matrix | `tests/e2e/test_auth_and_tenancy.py` |
| Tue 10 Feb 2026 | security: constant-time login for unknown emails | `app/security.py, app/routes/auth.py` |
| Thu 12 Feb 2026 | security: refuse default JWT secret when ENVIRONMENT=prod | `app/config.py` |
| Fri 13 Feb 2026 | fix(search): case-insensitive city/state filters | `app/routes/properties.py` |

## Sprint 17: Demo + real-data path  (16 Feb - 27 Feb 2026)

_Goal: Seed script, CSV training_

| Date | Commit | Files |
|---|---|---|
| Mon 16 Feb 2026 | feat(scripts): seed_demo (150 listings, 3 leads) | `scripts/seed_demo.py` |
| Wed 18 Feb 2026 | fix(seed): JSON-safe numpy scalars | `scripts/seed_demo.py` |
| Fri 20 Feb 2026 | chore: artifacts/.gitkeep, dockerignore tweaks | `artifacts/.gitkeep, .dockerignore, .gitignore` |
| Tue 24 Feb 2026 | feat(ml): --data CSV training path | `ml/pipeline.py` |
| Thu 26 Feb 2026 | feat(ml): min-rows guard + schema checks on CSV | `ml/train.py` |

## Sprint 18: Recommender perf  (02 Mar - 13 Mar 2026)

_Goal: Vectorising, stretch band, helper refactor_

| Date | Commit | Files |
|---|---|---|
| Mon 02 Mar 2026 | perf(recs): vectorised scoring | `ml/recommender.py` |
| Wed 04 Mar 2026 | fix(recs): 10% budget stretch with linear decay | `ml/recommender.py` |
| Fri 06 Mar 2026 | test(ml): liked-property pull, similar ordering | `tests/ml/test_recommender.py` |
| Tue 10 Mar 2026 | refactor: shared get_owned_* helpers across routes | `app/routes/properties.py, leads.py, outreach.py` |
| Thu 12 Mar 2026 | test(e2e): outreach cannot target another tenant's lead | `tests/e2e/test_auth_and_tenancy.py` |

## Sprint 19: CI hardening  (16 Mar - 27 Mar 2026)

_Goal: Caching, permissions, py3.10 fix, /model_

| Date | Commit | Files |
|---|---|---|
| Mon 16 Mar 2026 | ci: pip cache + cancel-in-progress concurrency | `ci.yml` |
| Wed 18 Mar 2026 | ci: least-privilege permissions on both workflows | `ci.yml, model-retrain.yml` |
| Fri 20 Mar 2026 | fix(py310): no nested same-quote f-strings | `scripts/seed_demo.py` |
| Tue 24 Mar 2026 | feat(system): /model exposes version + metrics | `app/routes/system.py` |
| Thu 26 Mar 2026 | test(e2e): LLM output rejected if figures/footer change | `tests/e2e/test_outreach_workflow.py` |

## Sprint 20: Gate tuning + outreach edges  (30 Mar - 10 Apr 2026)

_Goal: Tolerances, lifecycle conflicts_

| Date | Commit | Files |
|---|---|---|
| Mon 30 Mar 2026 | ml: tolerance on monotonicity probe | `ml/validate.py` |
| Wed 01 Apr 2026 | ml: interval coverage tolerance | `ml/validate.py` |
| Fri 03 Apr 2026 | fix(outreach): lead pitch wording above/below estimate | `app/services/outreach.py` |
| Tue 07 Apr 2026 | feat(outreach): list filter by status + limit | `app/routes/outreach.py` |
| Thu 09 Apr 2026 | fix(outreach): block mark-sent without recipient | `app/routes/outreach.py` |
| Fri 10 Apr 2026 | test(e2e): draft->sent conflicts (409) | `tests/e2e/test_outreach_workflow.py` |

## Sprint 21: Docs + audit coverage  (13 Apr - 24 Apr 2026)

_Goal: README, SQL comments, tests_

| Date | Commit | Files |
|---|---|---|
| Mon 13 Apr 2026 | docs(sql): policy and grant intent comments | `sql/*.sql` |
| Wed 15 Apr 2026 | test(db): audit visibility admin/tenant scoped | `tests/db/test_rls_and_audit.py` |
| Fri 17 Apr 2026 | chore: ruff zip(strict=True), import order | `ml/inference.py, app/security.py` |
| Tue 21 Apr 2026 | ci: attach model-report.json to registry artifact | `ci.yml, model-retrain.yml` |
| Thu 23 Apr 2026 | docs: README architecture, quickstart, config table | `README.md` |

## Sprint 22: Verification  (27 Apr - 08 May 2026)

_Goal: Compose smoke, deploy docs, port fix_

| Date | Commit | Files |
|---|---|---|
| Mon 27 Apr 2026 | docs: limits (mark-sent does not deliver; synthetic data) | `README.md` |
| Wed 29 Apr 2026 | docs: deploy notes - Supabase service role for ADMIN_DATABASE_URL | `README.md` |
| Fri 01 May 2026 | fix(pydantic): v2 deprecation cleanups | `app/schemas.py` |
| Mon 04 May 2026 | verify: full compose stack, RLS + audit smoke over HTTP | `docker-compose.yml` |
| Wed 06 May 2026 | fix(compose): Postgres on host port 55432 (avoid local clash) | `docker-compose.yml, README.md` |
| Fri 08 May 2026 | fix(main): log bootstrap-model validation failure | `app/main.py` |

## Sprint 23: Release  (11 May - 18 May 2026)

_Goal: Regression, 1.0.0, tag_

| Date | Commit | Files |
|---|---|---|
| Mon 11 May 2026 | test: final regression, SQLite + Postgres | `tests/` |
| Wed 13 May 2026 | chore: version 1.0.0, changelog | `pyproject.toml, README.md` |
| Thu 14 May 2026 | ci: v* tags trigger image publish | `ci.yml` |
| Mon 18 May 2026 | release: v1.0.0 | `-` |

## Commits per week

```
W01 07 Jul  ###
W02 14 Jul  ###
W03 21 Jul  ####
W04 28 Jul  ####
W05 04 Aug  ###
W06 11 Aug  ##
W07 18 Aug  ###
W08 25 Aug  ###
W09 01 Sep  ##
W10 08 Sep  ####
W11 15 Sep  ###
W12 22 Sep  ###
W13 29 Sep  ###
W14 06 Oct  ###
W15 13 Oct  ###
W16 20 Oct  ###
W17 27 Oct  ##
W18 03 Nov  ###
W19 10 Nov  ###
W20 17 Nov  ###
W21 24 Nov  ##
W22 01 Dec  ##
W23 08 Dec  ###
W24 15 Dec  ###
W25 22 Dec  ##
W26 29 Dec   (none)
W27 05 Jan  ###
W28 12 Jan  ##
W29 19 Jan  ###
W30 26 Jan  ###
W31 02 Feb  ###
W32 09 Feb  ###
W33 16 Feb  ###
W34 23 Feb  ##
W35 02 Mar  ###
W36 09 Mar  ##
W37 16 Mar  ###
W38 23 Mar  ##
W39 30 Mar  ###
W40 06 Apr  ###
W41 13 Apr  ###
W42 20 Apr  ##
W43 27 Apr  ###
W44 04 May  ###
W45 11 May  ###
W46 18 May  #
```
