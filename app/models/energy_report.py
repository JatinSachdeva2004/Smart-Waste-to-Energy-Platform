"""EnergyReport model — stores generated PDF reports."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.models.database import Base


class EnergyReport(Base):
    __tablename__ = "energy_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    report_type = Column(String(20), default="monthly")
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    total_records = Column(Integer, default=0)
    total_waste_kg = Column(Float, default=0.0)
    total_energy_kwh = Column(Float, default=0.0)
    total_co2_saved_kg = Column(Float, default=0.0)
    file_path = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
