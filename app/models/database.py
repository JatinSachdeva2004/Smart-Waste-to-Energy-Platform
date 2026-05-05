"""SQLAlchemy database engine, session, and base model."""
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.config import DATABASE_URL

logger = logging.getLogger(__name__)

# Use asyncpg for PostgreSQL, and aiosqlite for SQLite
if DATABASE_URL.startswith("postgresql"):
    # For PostgreSQL, use the asyncpg driver
    engine = create_async_engine(DATABASE_URL, echo=False, future=True)
else:
    # For SQLite, use aiosqlite and add connect_args
    engine = create_async_engine(DATABASE_URL, echo=False, future=True, connect_args={"check_same_thread": False})

AsyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a database session."""
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_column_if_missing(conn, table: str, column: str, col_type: str):
    """ALTER TABLE … ADD COLUMN only if the column does not already exist."""
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    existing = {row[1] for row in rows}
    if column not in existing:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        logger.info("DB migration: added %s.%s", table, column)


def init_db():
    """Create all tables and apply any missing-column migrations."""
    Base.metadata.create_all(bind=engine)

    # Columns added after initial release — safe to run on every startup
    migrations = [
        ("waste_records", "session_id",             "VARCHAR(64)"),
        ("waste_records", "object_index",            "INTEGER DEFAULT 0"),
        ("waste_records", "annotated_image_path",    "VARCHAR(500)"),
        ("waste_records", "confidence_level",        "VARCHAR(20)"),
        ("waste_records", "mask",                    "TEXT"),
        ("waste_records", "detection_warnings",      "TEXT"),
        ("waste_records", "best_realistic_kwh",      "FLOAT DEFAULT 0.0"),
        ("waste_records", "mass_confidence_pct",     "FLOAT DEFAULT 0.0"),
        ("waste_records", "manual_weight_kg",        "FLOAT"),
        ("waste_records", "estimation_method",       "VARCHAR(50)"),
    ]

    with engine.begin() as conn:
        for table, col, col_type in migrations:
            try:
                _add_column_if_missing(conn, table, col, col_type)
            except Exception as exc:
                logger.warning("Migration skipped (%s.%s): %s", table, col, exc)
