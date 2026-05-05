"""WasteRecord model — stores per-object analysis data."""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text

from app.models.database import Base


class WasteRecord(Base):
    __tablename__ = "waste_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String(64), nullable=True, index=True)  # groups multi-object from same upload
    object_index = Column(Integer, default=0)  # 0-based index within session
    image_path = Column(String(500), nullable=False)
    annotated_image_path = Column(String(500), nullable=True)

    # Detection
    waste_type = Column(String(50), nullable=False, index=True)
    waste_subtype = Column(String(50), nullable=True)
    confidence = Column(Float, default=0.0)
    confidence_level = Column(String(20), nullable=True)  # high/medium/low/very_low
    mask = Column(Text, nullable=True)  # JSON-encoded segmentation mask

    # Size / Mass
    estimated_area_cm2 = Column(Float, default=0.0)
    estimated_volume_m3 = Column(Float, default=0.0)
    estimated_mass_kg = Column(Float, default=0.0)
    estimation_method = Column(String(50), nullable=True)  # manual_weight / calibrated / vision / bbox_fallback
    mass_confidence_pct = Column(Float, default=0.0)
    manual_weight_kg = Column(Float, nullable=True)

    # Energy (kWh) per pathway
    energy_incineration_kwh = Column(Float, default=0.0)
    energy_pyrolysis_kwh = Column(Float, default=0.0)
    energy_biogas_kwh = Column(Float, default=0.0)
    energy_gasification_kwh = Column(Float, default=0.0)
    energy_plasma_kwh = Column(Float, default=0.0)
    energy_recycling_kwh = Column(Float, default=0.0)
    best_method = Column(String(50), default="")
    best_energy_kwh = Column(Float, default=0.0)
    best_realistic_kwh = Column(Float, default=0.0)

    # Environmental
    co2_saved_kg = Column(Float, default=0.0)
    methane_saved_kg = Column(Float, default=0.0)
    water_saved_liters = Column(Float, default=0.0)
    landfill_diverted_m3 = Column(Float, default=0.0)
    trees_equivalent = Column(Float, default=0.0)
    homes_powered_days = Column(Float, default=0.0)
    toxic_leachate_liters = Column(Float, default=0.0)
    soil_saved_m2 = Column(Float, default=0.0)

    # Recommendation
    recommendation_text = Column(Text, default="")
    is_hazardous = Column(Boolean, default=False)
    is_recyclable = Column(Boolean, default=False)

    # Warnings / metadata
    detection_warnings = Column(Text, nullable=True)  # JSON list of warning strings

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
