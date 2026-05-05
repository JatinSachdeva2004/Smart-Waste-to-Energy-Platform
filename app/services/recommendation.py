"""
Recommendation Engine.

Weighted scoring: energy_yield × 0.40 + environmental_benefit × 0.35 + cost_efficiency × 0.25
Returns best recommendation text block + action steps.
"""
from __future__ import annotations
from app.services.size_estimator import get_waste_properties

PATHWAY_LABELS = {
    "incineration": "Incineration (Waste-to-Energy Plant)",
    "pyrolysis": "Pyrolysis (Thermal Decomposition)",
    "biogas": "Anaerobic Digestion (Biogas Plant)",
    "gasification": "Gasification (Syngas Production)",
    "plasma_arc": "Plasma Arc Gasification",
    "recycling": "Recycling / Material Recovery",
}

# Rough cost index (lower is cheaper to build per tonne capacity)
COST_INDEX: dict[str, float] = {
    "incineration": 0.50,
    "pyrolysis": 0.60,
    "biogas": 0.70,
    "gasification": 0.55,
    "plasma_arc": 0.30,
    "recycling": 0.85,
}


def _normalize(values: list[float]) -> list[float]:
    mx = max(values) if values else 1.0
    return [v / mx if mx > 0 else 0.0 for v in values]


def generate_recommendation(
    mass_kg: float,
    pathways: dict,
    env_metrics: dict,
    waste_type: str,
    subtype: str | None = None,
) -> dict:
    """
    Score each applicable pathway and return recommendation block.
    """
    props = get_waste_properties(waste_type, subtype)
    recyclable = props.get("recyclable", False)
    hazardous = props.get("hazardous", False)
    best_methods = props.get("best_methods", [])

    # --- Scoring ----
    scores: dict[str, float] = {}
    for method, info in pathways.items():
        if not info.get("applicable"):
            continue

        energy_score = info["energy_kwh"]
        env_score = (
            env_metrics.get("co2_saved_kg", 0)
            + env_metrics.get("methane_saved_kg", 0) * 25  # CH₄ global warming equiv
            + env_metrics.get("water_saved_liters", 0) * 0.01
        )
        cost_score = COST_INDEX.get(method, 0.5)

        # Weighted composite
        scores[method] = (
            energy_score * 0.40
            + env_score * 0.35
            + cost_score * 0.25
        )

    if not scores:
        return {
            "recommended_method": "recycling" if recyclable else "incineration",
            "score": 0.0,
            "text": "Insufficient data to rank pathways. General recycling recommended.",
            "action_steps": ["Collect and sort waste", "Contact local recycling facility"],
        }

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_method, top_score = ranked[0]

    # --- Build human-readable text ----
    label = PATHWAY_LABELS.get(top_method, top_method)

    lines: list[str] = []
    lines.append(f"🏆 Recommended: {label}")
    lines.append(f"Energy Yield: {pathways[top_method]['energy_kwh']:.4f} kWh from {mass_kg:.3f} kg waste")
    lines.append(f"CO₂ Saved: {env_metrics.get('co2_saved_kg', 0):.3f} kg")

    if recyclable:
        lines.append("♻️ This waste is recyclable — material recovery should be prioritised.")
    if hazardous:
        lines.append("⚠️ Hazardous waste — requires licensed handling & special safety protocols.")

    # Action steps
    steps = _action_steps(top_method, recyclable, hazardous)

    return {
        "recommended_method": top_method,
        "recommended_label": label,
        "score": round(top_score, 4),
        "ranking": [{"method": m, "score": round(s, 4)} for m, s in ranked],
        "text": "\n".join(lines),
        "action_steps": steps,
        "is_recyclable": recyclable,
        "is_hazardous": hazardous,
    }


def _action_steps(method: str, recyclable: bool, hazardous: bool) -> list[str]:
    base: dict[str, list[str]] = {
        "incineration": [
            "Transport to nearest Waste-to-Energy incineration plant",
            "Ensure moisture content < 50 % for efficient combustion",
            "Recover bottom ash for construction aggregate",
        ],
        "pyrolysis": [
            "Shred / chip waste to <50 mm particle size",
            "Feed into pyrolysis reactor at 400-700 °C in absence of O₂",
            "Collect bio-oil & syngas for fuel or chemical feedstock",
        ],
        "biogas": [
            "Mix with water to create slurry (1:1 ratio)",
            "Load into anaerobic digester at 35-55 °C",
            "Capture biogas (55-70 % CH₄) for electricity generation or CNG",
            "Use digestate as organic fertiliser",
        ],
        "gasification": [
            "Dry waste to < 20 % moisture",
            "Feed into gasifier at 700-1200 °C with limited O₂",
            "Clean syngas and use in gas turbine for power generation",
        ],
        "plasma_arc": [
            "Pre-sort to remove large metal items",
            "Process in plasma torch reactor at 5000+ °C",
            "Recover vitrified slag (inert, safe for landfill or construction)",
            "Use syngas for electricity or hydrogen production",
        ],
        "recycling": [
            "Sort and clean waste material",
            "Transport to appropriate recycling facility",
            "Process into secondary raw material",
            "Re-introduce into manufacturing supply chain",
        ],
    }
    steps = list(base.get(method, ["Consult waste management professionals"]))
    if hazardous:
        steps.insert(0, "⚠️ Use PPE and follow hazardous-waste handling protocols")
    if recyclable and method != "recycling":
        steps.append("Consider partial recycling to maximise material recovery")
    return steps
