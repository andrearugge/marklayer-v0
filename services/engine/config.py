from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/ai_visibility_platform"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Brave Search API (Step 2b.2+)
    brave_search_api_key: str = ""

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
