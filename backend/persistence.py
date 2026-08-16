import os
import re
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


ROOT_DIR = Path(__file__).parent
DEFAULT_SQLITE_PATH = (ROOT_DIR / "data" / "bookmyload.db").resolve()
DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"
)
if DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith("sqlite:////"):
    sqlite_path = DATABASE_URL.removeprefix("sqlite:///")
    if not Path(sqlite_path).is_absolute() and not re.match(r"^[A-Za-z]:", sqlite_path):
        DATABASE_URL = f"sqlite:///{(ROOT_DIR / sqlite_path).resolve().as_posix()}"

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    DEFAULT_SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


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


def initialize_database():
    # Imported here so model metadata is registered before create_all.
    import orm_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
