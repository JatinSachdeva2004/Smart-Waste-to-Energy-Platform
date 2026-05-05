"""
Insights route — advanced unique features:
  - Decomposition timeline data
  - Carbon credit wallet
  - Waste calendar heatmap
  - What-if scenario engine
  - Comparison mode
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.models.database import get_db
from app.models.waste_record import WasteRecord

router = APIRouter(prefix="/api/insights", tags=["Insights"])

# ── Decomposition timelines (years) by waste type ──────
DECOMPOSITION_YEARS: dict[str, float] = {
    "plastic": 450.0,
    "paper": 0.08,        # ~1 month
    "metal": 200.0,
    "glass": 1000000.0,   # effectively forever
    "organic": 0.04,      # ~2 weeks
    "ewaste": 1000000.0,
    "textile": 40.0,
    "wood": 15.0,
    "rubber": 80.0,
    "medical": 0.5,
    "construction": 100.0,
    "ceramic": 1000000.0,
    "composite": 40.0,
    "garden": 0.08,
    "ash": 1000000.0,
}

DECOMPOSITION_LABELS: dict[str, str] = {
    "plastic": "450 years",
    "paper": "1 month",
    "metal": "200 years",
    "glass": "1 million years",
    "organic": "2 weeks",
    "ewaste": "Never (leaches toxins)",
    "textile": "40 years",
    "wood": "15 years",
    "rubber": "80 years",
    "medical": "6 months (biohazard)",
    "construction": "100+ years",
    "ceramic": "Practically forever",
    "composite": "40 years",
    "garden": "1 month",
    "ash": "Practically forever",
}

# ── Carbon credit pricing (INR per tonne CO₂) ─────────
CARBON_CREDIT_INR_PER_TONNE = 1200.0   # Indian carbon exchange ~rate
CARBON_CREDIT_USD_PER_TONNE = 14.4     # ~equivalent


@router.get("/decomposition")
async def decomposition_timeline(db: Session = Depends(get_db)):
    """Get decomposition timeline for all analyzed waste types."""
    rows = (
        db.query(
            WasteRecord.waste_type,
            func.count(WasteRecord.id).label("count"),
            func.sum(WasteRecord.estimated_mass_kg).label("total_mass"),
        )
        .group_by(WasteRecord.waste_type)
        .all()
    )
    items = []
    for r in rows:
        wt = r.waste_type or "general_waste"
        years = DECOMPOSITION_YEARS.get(wt, 50.0)
        label = DECOMPOSITION_LABELS.get(wt, f"{int(years)} years")
        items.append({
            "waste_type": wt,
            "count": r.count,
            "total_mass_kg": round(r.total_mass or 0, 3),
            "decomposition_years": years,
            "decomposition_label": label,
            "landfill_impact": "critical" if years > 100 else "moderate" if years > 5 else "low",
        })
    items.sort(key=lambda x: x["decomposition_years"], reverse=True)
    return {"timeline": items}


@router.get("/carbon-credits")
async def carbon_credits(db: Session = Depends(get_db)):
    """Calculate cumulative carbon credits earned."""
    total_co2 = db.query(func.sum(WasteRecord.co2_saved_kg)).scalar() or 0.0
    total_energy = db.query(func.sum(WasteRecord.best_energy_kwh)).scalar() or 0.0
    total_records = db.query(func.count(WasteRecord.id)).scalar() or 0

    # Monthly breakdown
    monthly = (
        db.query(
            func.strftime("%Y-%m", WasteRecord.created_at).label("month"),
            func.sum(WasteRecord.co2_saved_kg).label("co2"),
            func.count(WasteRecord.id).label("count"),
        )
        .group_by(func.strftime("%Y-%m", WasteRecord.created_at))
        .order_by(func.strftime("%Y-%m", WasteRecord.created_at))
        .all()
    )

    tonnes_co2 = total_co2 / 1000.0
    return {
        "total_co2_saved_kg": round(total_co2, 4),
        "total_co2_tonnes": round(tonnes_co2, 6),
        "credits_earned": round(tonnes_co2, 4),
        "value_inr": round(tonnes_co2 * CARBON_CREDIT_INR_PER_TONNE, 2),
        "value_usd": round(tonnes_co2 * CARBON_CREDIT_USD_PER_TONNE, 2),
        "total_energy_kwh": round(total_energy, 4),
        "total_records": total_records,
        "monthly_breakdown": [
            {
                "month": r.month,
                "co2_saved_kg": round(r.co2 or 0, 4),
                "credits": round((r.co2 or 0) / 1000.0, 6),
                "value_inr": round((r.co2 or 0) / 1000.0 * CARBON_CREDIT_INR_PER_TONNE, 2),
                "count": r.count,
            }
            for r in monthly
        ],
    }


@router.get("/heatmap")
async def waste_heatmap(days: int = Query(365, ge=30, le=730), db: Session = Depends(get_db)):
    """GitHub-style heatmap of daily waste analysis activity."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(
            func.date(WasteRecord.created_at).label("day"),
            func.count(WasteRecord.id).label("count"),
            func.sum(WasteRecord.estimated_mass_kg).label("mass"),
            func.sum(WasteRecord.co2_saved_kg).label("co2"),
        )
        .filter(WasteRecord.created_at >= cutoff)
        .group_by(func.date(WasteRecord.created_at))
        .order_by(func.date(WasteRecord.created_at))
        .all()
    )
    return {
        "days": days,
        "data": [
            {
                "date": str(r.day),
                "count": r.count,
                "mass_kg": round(r.mass or 0, 3),
                "co2_saved_kg": round(r.co2 or 0, 4),
            }
            for r in rows
        ],
    }


@router.get("/whatif")
async def whatif_scenario(
    waste_type: str = Query("plastic"),
    mass_kg: float = Query(1.0, ge=0.001, le=10000),
    method: str = Query("pyrolysis"),
    recycling_rate: float = Query(1.0, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
):
    """
    What-if scenario engine: Calculate energy and environmental impact
    for hypothetical waste processing scenarios.
    """
    from app.services.energy_calculator import calculate_energy
    from app.services.environmental import calculate_environmental_impact

    adjusted_mass = mass_kg * recycling_rate

    energy_data = calculate_energy(adjusted_mass, waste_type)
    env_data = calculate_environmental_impact(adjusted_mass, energy_data.get("best_realistic_kwh", 0), waste_type)

    # Also calculate for landfill (zero recovery) as comparison
    landfill_co2 = mass_kg * 0.5   # approximate landfill CO₂
    landfill_methane = mass_kg * 0.05

    return {
        "scenario": {
            "waste_type": waste_type,
            "mass_kg": mass_kg,
            "method": method,
            "recycling_rate": recycling_rate,
            "effective_mass_kg": round(adjusted_mass, 3),
        },
        "recovery": {
            "energy": energy_data,
            "environmental": env_data,
        },
        "landfill_comparison": {
            "co2_emitted_kg": round(landfill_co2, 4),
            "methane_emitted_kg": round(landfill_methane, 4),
            "co2_difference_kg": round(env_data["co2_saved_kg"], 4),
            "energy_wasted_kwh": round(energy_data.get("best_energy_kwh", 0), 4),
        },
        "carbon_credit_value_inr": round(
            env_data["co2_saved_kg"] / 1000.0 * CARBON_CREDIT_INR_PER_TONNE, 2
        ),
    }


@router.get("/comparison")
async def comparison_mode(
    ids: str = Query(..., description="Comma-separated record IDs"),
    db: Session = Depends(get_db),
):
    """Compare multiple waste records side by side."""
    try:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        return {"error": "Invalid IDs format. Use comma-separated integers."}

    records = db.query(WasteRecord).filter(WasteRecord.id.in_(id_list)).all()
    if not records:
        return {"items": [], "totals": {}}

    items = []
    for r in records:
        items.append({
            "id": r.id,
            "waste_type": r.waste_type,
            "waste_subtype": r.waste_subtype,
            "confidence": r.confidence,
            "mass_kg": r.estimated_mass_kg,
            "energy_kwh": r.best_energy_kwh,
            "best_method": r.best_method,
            "co2_saved_kg": r.co2_saved_kg,
            "water_saved_liters": r.water_saved_liters,
            "trees_equivalent": r.trees_equivalent,
            "image_path": r.image_path,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "items": items,
        "totals": {
            "mass_kg": round(sum(i["mass_kg"] for i in items), 3),
            "energy_kwh": round(sum(i["energy_kwh"] for i in items), 4),
            "co2_saved_kg": round(sum(i["co2_saved_kg"] for i in items), 4),
            "water_saved_liters": round(sum(i["water_saved_liters"] for i in items), 3),
        },
    }
