from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://civicfix:civicfix@localhost:5432/civicfix"
    MONGO_URL: str = "mongodb://localhost:27017"
    MONGO_DB: str = "civicfix"
    JWT_SECRET: str = "change-me"
    JWT_EXPIRE_MINUTES: int = 60 * 24
    UPLOAD_DIR: str = "uploads"
    ESCALATION_INTERVAL_SECONDS: int = 300
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
