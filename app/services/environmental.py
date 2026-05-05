"""
Environmental Impact Analyzer — 8 metrics.

Metrics:
  1. CO₂ Reduction           (kg)
  2. Methane Prevention       (kg)
  3. Water Saved              (litres)
  4. Landfill Space Diverted  (m³)
  5. Trees Equivalent         (count)
  6. Homes Powered            (days)
  7. Toxic Leachate Prevented (litres)
  8. Soil Contamination Avoided (m²)
"""
from app.config import CO2_PER_TREE_PER_YEAR_KG, AVG_HOME_DAILY_KWH
from app.services.size_estimator import get_waste_properties


def calculate_environmental_impact(
    mass_kg: float,
    best_energy_kwh: float,
    waste_type: str,
    subtype: str | None = None,
) -> dict:
    props = get_waste_properties(waste_type, subtype)
    density = props.get("density_kg_m3", 200.0)

    co2_lf = props.get("co2_landfill_factor", 0.5)       # kg CO₂ per kg waste in landfill
    co2_cv = props.get("co2_conversion_factor", 0.2)      # kg CO₂ emitted during conversion
    methane_f = props.get("methane_factor", 0.05)          # kg CH₄ per kg in landfill
    water_f = props.get("water_saved_per_kg_liters", 0.0)
    leachate_f = props.get("leachate_factor", 0.01)        # litre per kg
    hazardous = props.get("hazardous", False)

    # 1. CO₂ saved = landfill emissions avoided − conversion emissions
    co2_saved = mass_kg * co2_lf - mass_kg * co2_cv
    co2_saved = max(co2_saved, 0.0)

    # 2. Methane prevented
    methane_saved = mass_kg * methane_f

    # 3. Water saved (mainly for recyclables)
    water_saved = mass_kg * water_f

    # 4. Landfill volume diverted
    landfill_m3 = mass_kg / density if density > 0 else 0.0

    # 5. Trees equivalent — how many trees would absorb same CO₂ in a year
    trees_equiv = co2_saved / CO2_PER_TREE_PER_YEAR_KG if CO2_PER_TREE_PER_YEAR_KG > 0 else 0.0

    # 6. Homes powered (days)
    homes_days = best_energy_kwh / AVG_HOME_DAILY_KWH if AVG_HOME_DAILY_KWH > 0 else 0.0

    # 7. Toxic leachate prevented
    leachate_litres = mass_kg * leachate_f

    # 8. Soil contamination avoided — multiplier for hazardous
    soil_m2 = mass_kg * 0.05 * (5.0 if hazardous else 1.0)

    return {
        "co2_saved_kg": round(co2_saved, 4),
        "methane_saved_kg": round(methane_saved, 4),
        "water_saved_liters": round(water_saved, 4),
        "landfill_diverted_m3": round(landfill_m3, 6),
        "trees_equivalent": round(trees_equiv, 4),
        "homes_powered_days": round(homes_days, 6),
        "toxic_leachate_liters": round(leachate_litres, 4),
        "soil_saved_m2": round(soil_m2, 4),
    }
