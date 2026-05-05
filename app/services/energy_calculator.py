"""
Multi-Pathway Energy Calculator — with real-world modifiers.

6 conversion pathways:
  1. Incineration   — burn → heat → electricity
  2. Pyrolysis      — thermal decomposition without O₂ → syngas + bio-oil
  3. Biogas         — anaerobic digestion → methane
  4. Gasification   — partial combustion → syngas
  5. Plasma Arc     — ultra-high temp → syngas + vitrified slag
  6. Recycling      — energy saved vs virgin production

Real-world modifiers:
  - Moisture content (wet waste reduces combustion efficiency)
  - Contamination factor (mixed/dirty waste reduces yield)
  - Both theoretical and realistic estimates are returned.
"""
from app.config import KWH_PER_MJ
from app.services.size_estimator import get_waste_properties

PATHWAY_NAMES = {
    "incineration": "Incineration",
    "pyrolysis": "Pyrolysis",
    "biogas": "Anaerobic Digestion (Biogas)",
    "gasification": "Gasification",
    "plasma_arc": "Plasma Arc Gasification",
    "recycling": "Recycling (Energy Saved)",
}

# Default moisture content (%) by waste type
DEFAULT_MOISTURE: dict[str, float] = {
    "plastic": 2.0, "paper": 8.0, "metal": 1.0, "glass": 1.0,
    "organic": 60.0, "organic_food": 70.0, "organic_garden": 50.0,
    "ewaste": 2.0, "textile": 10.0, "wood": 20.0, "rubber": 3.0,
    "medical": 15.0, "chemical": 5.0, "construction": 8.0,
    "composite": 5.0, "general_waste": 25.0,
}

# Contamination penalty factors (0 = clean, 1 = heavily contaminated)
CONTAMINATION_LEVELS = {
    "clean":  0.00,
    "light":  0.10,
    "medium": 0.20,
    "heavy":  0.35,
}


def _moisture_penalty(moisture_pct: float, method: str) -> float:
    """
    Returns a multiplier (0-1) reducing energy output based on moisture.
    Biogas is less affected; combustion methods are heavily penalised.
    """
    if method == "biogas":
        # Biogas actually benefits from some moisture (up to 80%)
        if moisture_pct <= 80:
            return 1.0
        return max(0.3, 1.0 - (moisture_pct - 80) / 100)
    elif method == "recycling":
        return 1.0  # moisture doesn't affect recycling energy savings
    else:
        # Combustion methods: energy drops with moisture
        # Rule: ~1% loss per 1.5% moisture above 5%
        excess = max(0, moisture_pct - 5)
        return max(0.30, 1.0 - excess / 150)


def calculate_energy(
    mass_kg: float,
    waste_type: str,
    subtype: str | None = None,
    moisture_pct: float | None = None,
    contamination: str = "light",
) -> dict:
    """
    Calculate energy potential via all 6 pathways.
    Returns both theoretical and realistic (real-world adjusted) values.
    """
    props = get_waste_properties(waste_type, subtype)
    energy_mj = props.get("energy_content_mj_kg", 10.0)
    efficiencies = props.get("method_efficiency", {})
    virgin_energy = props.get("virgin_production_energy_mj_kg", 0.0)
    biogas_yield = props.get("biogas_yield_m3_per_kg", 0.0)

    # Resolve moisture
    if moisture_pct is None:
        moisture_pct = DEFAULT_MOISTURE.get(waste_type, 15.0)

    contam_factor = 1.0 - CONTAMINATION_LEVELS.get(contamination, 0.10)

    pathways: dict[str, dict] = {}
    best_method = ""
    best_kwh = 0.0
    best_realistic = 0.0

    for method in ["incineration", "pyrolysis", "biogas", "gasification", "plasma_arc"]:
        eff = efficiencies.get(method, 0.0)
        if method == "biogas" and biogas_yield > 0:
            kwh = mass_kg * biogas_yield * 6.0 * eff / 0.65
        elif eff > 0:
            kwh = mass_kg * energy_mj * eff * KWH_PER_MJ
        else:
            kwh = 0.0

        # Real-world adjusted
        mp = _moisture_penalty(moisture_pct, method)
        realistic_kwh = kwh * mp * contam_factor

        applicable = kwh > 0
        pathways[method] = {
            "name": PATHWAY_NAMES[method],
            "energy_kwh": round(kwh, 4),
            "realistic_kwh": round(realistic_kwh, 4),
            "efficiency_pct": round(eff * 100, 1),
            "moisture_penalty": round((1 - mp) * 100, 1),
            "applicable": applicable,
        }
        if realistic_kwh > best_realistic:
            best_realistic = realistic_kwh
            best_kwh = kwh
            best_method = method

    # Recycling — energy saved
    recycle_pct = efficiencies.get("recycling_energy_saved_pct", 0.0)
    recycle_kwh = mass_kg * virgin_energy * recycle_pct * KWH_PER_MJ if recycle_pct > 0 else 0.0
    realistic_recycle = recycle_kwh * contam_factor
    pathways["recycling"] = {
        "name": PATHWAY_NAMES["recycling"],
        "energy_kwh": round(recycle_kwh, 4),
        "realistic_kwh": round(realistic_recycle, 4),
        "efficiency_pct": round(recycle_pct * 100, 1),
        "moisture_penalty": 0.0,
        "applicable": recycle_kwh > 0,
    }
    if realistic_recycle > best_realistic:
        best_realistic = realistic_recycle
        best_kwh = recycle_kwh
        best_method = "recycling"

    total_theoretical = sum(p["energy_kwh"] for p in pathways.values() if p["applicable"])
    total_realistic = sum(p["realistic_kwh"] for p in pathways.values() if p["applicable"])

    return {
        "pathways": pathways,
        "best_method": best_method,
        "best_method_name": PATHWAY_NAMES.get(best_method, best_method),
        "best_energy_kwh": round(best_kwh, 4),
        "best_realistic_kwh": round(best_realistic, 4),
        "total_potential_kwh": round(total_theoretical, 4),
        "total_realistic_kwh": round(total_realistic, 4),
        "modifiers": {
            "moisture_pct": round(moisture_pct, 1),
            "contamination": contamination,
            "contamination_loss_pct": round((1 - contam_factor) * 100, 1),
        },
    }
