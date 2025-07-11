from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-secret-change-me-0123456789abcdef"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", protected_namespaces=("settings_",))

    environment: str = "dev"  # dev | test | prod
    # API connection. In Postgres this should be the low-privilege role so RLS applies.
    database_url: str = "sqlite:///./data/app.db"
    # Service connection (RLS bypass) used only for signup/login. Defaults to database_url.
    admin_database_url: str | None = None
    auto_create_tables: bool = True  # SQLite dev only; Postgres uses sql/*.sql migrations

    jwt_secret: str = DEV_SECRET
    jwt_expire_minutes: int = 60 * 8

    model_registry_dir: str = "artifacts/price_model"
    auto_bootstrap_model: bool = True  # train a small model on first start if none is promoted
    bootstrap_rows: int = 4000

    # Optional LLM polish for outreach drafts; falls back to templates if unset/failing.
    anthropic_api_key: str | None = None
    outreach_llm_model: str = "claude-haiku-5-5"
    sender_name: str = "Your Real Estate Team"
    sender_company: str = "Realestate AI Outreach"
    sender_address: str = "123 Main St, Austin, TX 78701"  # CAN-SPAM requires a postal address

    @model_validator(mode="after")
    def _prod_needs_real_secret(self) -> Settings:
        if self.environment == "prod" and self.jwt_secret == DEV_SECRET:
            raise ValueError("JWT_SECRET must be set in production")
        return self
