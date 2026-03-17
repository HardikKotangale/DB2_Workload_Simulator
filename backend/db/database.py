from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine
from db.models import Base

import os, pathlib
_db_dir = pathlib.Path(os.getenv("SQLITE_DIR", "."))
_db_dir.mkdir(parents=True, exist_ok=True)
_db_path = _db_dir / "simulator.db"

SQLITE_URL_ASYNC = f"sqlite+aiosqlite:///{_db_path}"
SQLITE_URL_SYNC = f"sqlite:///{_db_path}"

engine = create_async_engine(SQLITE_URL_ASYNC, echo=False)
sync_engine = create_engine(SQLITE_URL_SYNC, echo=False, connect_args={"check_same_thread": False})

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
SyncSessionLocal = sessionmaker(sync_engine, class_=Session, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
