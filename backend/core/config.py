from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    db2_host: str = "127.0.0.1"
    db2_port: int = 50000
    db2_dbname: str = "SAMPLEDB"
    db2_user: str = "db2inst1"
    db2_password: str = "Passw0rd123!"
    sqlite_path: str = "simulator.db"

    class Config:
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
