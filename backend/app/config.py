from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "mysql+pymysql://root:password@127.0.0.1:3306/patcat?charset=utf8mb4"
    tianditu_key: str = "0d1ea9c19bb0ba6b84fe314ddcbe74ed"


settings = Settings()
