"""FastAPI app factory.   uvicorn app.main:create_app --factory"""
from __future__ import annotations

import logging

from fastapi import FastAPI

from app.config import Settings
from app.db import make_engine
from app.models import Base
from app.routes import auth, insights, leads, outreach, properties, system
from ml.inference import PricePredictor
from ml.pipeline import run_pipeline
from ml.registry import ModelRegistry

log = logging.getLogger("app")


def load_predictor(settings: Settings) -> PricePredictor | None:
    registry = ModelRegistry(settings.model_registry_dir)
    if registry.current_version() is None and settings.auto_bootstrap_model:
        log.info("no promoted model; bootstrapping on %d synthetic rows", settings.bootstrap_rows)
        out = run_pipeline(registry, rows=settings.bootstrap_rows)
        if not out["promoted"]:
            log.error("bootstrap model failed validation: %s", out["validation"])
    if registry.current_version() is None:
        return None
    return PricePredictor.from_registry(registry)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="Realestate AI Outreach", version="1.0.0")

    engine = make_engine(settings.database_url)
    admin_engine = make_engine(settings.admin_database_url) if settings.admin_database_url else engine
    if settings.auto_create_tables and engine.dialect.name == "sqlite":
        Base.metadata.create_all(admin_engine)

    app.state.settings = settings
    app.state.engine = engine
    app.state.admin_engine = admin_engine
    app.state.predictor = load_predictor(settings)

    for module in (system, auth, properties, leads, insights, outreach):
        app.include_router(module.router)
    return app
