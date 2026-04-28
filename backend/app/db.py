from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


ENGINE_KWARGS = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
    "pool_size": 10,
    "max_overflow": 20,
    "pool_timeout": 30,
    "pool_use_lifo": True,
}

if settings.database_url.startswith("mysql+pymysql://"):
    ENGINE_KWARGS["connect_args"] = {
        "connect_timeout": 10,
        "read_timeout": 30,
        "write_timeout": 30,
    }

engine = create_engine(settings.database_url, **ENGINE_KWARGS)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
