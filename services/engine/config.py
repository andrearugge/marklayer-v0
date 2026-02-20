from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/ai_visibility_platform"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Google Custom Search Engine (Step 2b.2+)
    google_cse_api_key: str = ""
    google_cse_id: str = ""

    # Anthropic
    anthropic_api_key: str = ""

    # Internal API security — Next.js sends this header when calling the engine
    engine_api_key: str = "changeme-in-production"

    # CORS — comma-separated list of allowed origins
    allowed_origins: str = "http://localhost:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
