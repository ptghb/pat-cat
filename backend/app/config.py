from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "mysql+pymysql://root:password@127.0.0.1:3306/patcat?charset=utf8mb4"
    sync_interval_seconds: int = 6 * 60 * 60
    initial_sync_on_startup: bool = True


settings = Settings()

