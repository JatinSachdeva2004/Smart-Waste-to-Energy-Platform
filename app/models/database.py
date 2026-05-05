"""SQLAlchemy database engine, session, and base model."""
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

logger = logging.getLogger(__name__)

# Convert async-driver URLs to sync (routes all use sync db.query() API)
_sync_url = (
    DATABASE_URL
    .replace("sqlite+aiosqlite:", "sqlite:")
    .replace("+asyncpg", "")
)
_connect_args = {"check_same_thread": False} if _sync_url.startswith("sqlite") else {}

engine = create_engine(_sync_url, echo=False, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_column_if_missing(conn, table: str, column: str, col_type: str):
    try:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        existing = {row[1] for row in rows}
        if column not in existing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
            logger.info("DB migration: added %s.%s", table, column)
    except Exception:
        pass  # PRAGMA is SQLite-only; PostgreSQL skips safely


def init_db():
    Base.metadata.create_all(bind=engine)

    migrations = [
        ("waste_records", "session_id",           "VARCHAR(64)"),
        ("waste_records", "object_index",          "INTEGER DEFAULT 0"),
        ("waste_records", "annotated_image_path",  "VARCHAR(500)"),
        ("waste_records", "confidence_level",      "VARCHAR(20)"),
        ("waste_records", "mask",                  "TEXT"),
        ("waste_records", "detection_warnings",    "TEXT"),
        ("waste_records", "best_realistic_kwh",    "FLOAT DEFAULT 0.0"),
        ("waste_records", "mass_confidence_pct",   "FLOAT DEFAULT 0.0"),
        ("waste_records", "manual_weight_kg",      "FLOAT"),
        ("waste_records", "estimation_method",     "VARCHAR(50)"),
    ]

    with engine.begin() as conn:
        for table, col, col_type in migrations:
            try:
                _add_column_if_missing(conn, table, col, col_type)
            except Exception as exc:
                logger.warning("Migration skipped (%s.%s): %s", table, col, exc)
