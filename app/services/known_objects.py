"""
Known Object Mass Database — bypass estimation for recognizable items.

When the AI classifier + subtype identifies a *specific* common object
(e.g., "PET bottle", "aluminium can", "banana peel"), we can directly
look up its typical mass, volume, and density from empirical data.

This eliminates the scale-ambiguity problem entirely for standard items.
Accuracy: 60-85% for known objects (much better than pixel heuristics alone).
"""
from __future__ import annotations

# ── Database of known waste objects with empirical measurements ──
# Format: "waste_type:subtype_or_label" → {mass_kg, volume_cm3, confidence_pct, description}
# Sources: product specs, waste audit studies, EPA waste characterization data

KNOWN_OBJECTS: dict[str, dict] = {
    # ── PLASTIC ──
    "plastic:pet_bottle_500ml": {
        "mass_kg": 0.020, "volume_cm3": 550,
        "confidence_pct": 80, "description": "PET water bottle (500ml)",
    },
    "plastic:pet_bottle_1l": {
        "mass_kg": 0.035, "volume_cm3": 1100,
        "confidence_pct": 78, "description": "PET bottle (1 litre)",
    },
    "plastic:pet_bottle_2l": {
        "mass_kg": 0.050, "volume_cm3": 2200,
        "confidence_pct": 75, "description": "PET bottle (2 litre)",
    },
    "plastic:hdpe_milk_jug": {
        "mass_kg": 0.060, "volume_cm3": 3800,
        "confidence_pct": 75, "description": "HDPE milk jug (1 gallon)",
    },
    "plastic:plastic_bag": {
        "mass_kg": 0.006, "volume_cm3": 20,
        "confidence_pct": 85, "description": "Single-use plastic bag",
    },
    "plastic:plastic_cup": {
        "mass_kg": 0.008, "volume_cm3": 350,
        "confidence_pct": 80, "description": "Disposable plastic cup",
    },
    "plastic:plastic_straw": {
        "mass_kg": 0.001, "volume_cm3": 5,
        "confidence_pct": 90, "description": "Plastic drinking straw",
    },
    "plastic:styrofoam_container": {
        "mass_kg": 0.015, "volume_cm3": 1200,
        "confidence_pct": 75, "description": "Styrofoam food container",
    },
    "plastic:plastic_wrapper": {
        "mass_kg": 0.003, "volume_cm3": 10,
        "confidence_pct": 82, "description": "Plastic food wrapper",
    },

    # ── PAPER ──
    "paper:newspaper": {
        "mass_kg": 0.300, "volume_cm3": 800,
        "confidence_pct": 78, "description": "Newspaper (single edition)",
    },
    "paper:a4_sheet": {
        "mass_kg": 0.005, "volume_cm3": 5,
        "confidence_pct": 92, "description": "Single A4 paper sheet (80gsm)",
    },
    "paper:cardboard_box_small": {
        "mass_kg": 0.200, "volume_cm3": 5000,
        "confidence_pct": 65, "description": "Small cardboard box (~30cm)",
    },
    "paper:cardboard_box_medium": {
        "mass_kg": 0.600, "volume_cm3": 27000,
        "confidence_pct": 60, "description": "Medium cardboard box (~50cm)",
    },
    "paper:tissue_paper": {
        "mass_kg": 0.002, "volume_cm3": 15,
        "confidence_pct": 88, "description": "Single tissue paper",
    },
    "paper:paper_cup": {
        "mass_kg": 0.010, "volume_cm3": 300,
        "confidence_pct": 82, "description": "Paper coffee cup",
    },
    "paper:paper_plate": {
        "mass_kg": 0.012, "volume_cm3": 200,
        "confidence_pct": 80, "description": "Paper plate",
    },

    # ── METAL ──
    "metal:aluminium_can": {
        "mass_kg": 0.015, "volume_cm3": 355,
        "confidence_pct": 85, "description": "Aluminium soda can (355ml)",
    },
    "metal:steel_can": {
        "mass_kg": 0.050, "volume_cm3": 400,
        "confidence_pct": 80, "description": "Steel food can",
    },
    "metal:aluminium_foil": {
        "mass_kg": 0.005, "volume_cm3": 50,
        "confidence_pct": 75, "description": "Aluminium foil sheet",
    },
    "metal:tin_can_large": {
        "mass_kg": 0.100, "volume_cm3": 850,
        "confidence_pct": 72, "description": "Large tin can",
    },

    # ── GLASS ──
    "glass:glass_bottle_330ml": {
        "mass_kg": 0.200, "volume_cm3": 400,
        "confidence_pct": 80, "description": "Glass bottle (330ml)",
    },
    "glass:glass_bottle_750ml": {
        "mass_kg": 0.400, "volume_cm3": 900,
        "confidence_pct": 78, "description": "Glass wine bottle (750ml)",
    },
    "glass:glass_jar": {
        "mass_kg": 0.250, "volume_cm3": 500,
        "confidence_pct": 72, "description": "Glass jar (medium)",
    },
    "glass:broken_glass": {
        "mass_kg": 0.150, "volume_cm3": 100,
        "confidence_pct": 50, "description": "Broken glass fragments",
    },

    # ── ORGANIC ──
    "organic:banana_peel": {
        "mass_kg": 0.040, "volume_cm3": 120,
        "confidence_pct": 82, "description": "Banana peel",
    },
    "organic:apple_core": {
        "mass_kg": 0.050, "volume_cm3": 80,
        "confidence_pct": 80, "description": "Apple core",
    },
    "organic:orange_peel": {
        "mass_kg": 0.060, "volume_cm3": 150,
        "confidence_pct": 78, "description": "Orange peel",
    },
    "organic:food_scraps_small": {
        "mass_kg": 0.100, "volume_cm3": 200,
        "confidence_pct": 55, "description": "Food scraps (small plate)",
    },
    "organic:tea_bag": {
        "mass_kg": 0.004, "volume_cm3": 10,
        "confidence_pct": 88, "description": "Used tea bag",
    },
    "organic:coconut_shell": {
        "mass_kg": 0.200, "volume_cm3": 600,
        "confidence_pct": 75, "description": "Coconut shell (half)",
    },
    "organic:leaf_pile_small": {
        "mass_kg": 0.050, "volume_cm3": 500,
        "confidence_pct": 50, "description": "Small pile of leaves",
    },

    # ── E-WASTE ──
    "ewaste:phone_old": {
        "mass_kg": 0.170, "volume_cm3": 80,
        "confidence_pct": 82, "description": "Old mobile phone",
    },
    "ewaste:battery_aa": {
        "mass_kg": 0.023, "volume_cm3": 8,
        "confidence_pct": 90, "description": "AA battery",
    },
    "ewaste:keyboard": {
        "mass_kg": 0.500, "volume_cm3": 1500,
        "confidence_pct": 78, "description": "Computer keyboard",
    },
    "ewaste:mouse": {
        "mass_kg": 0.100, "volume_cm3": 80,
        "confidence_pct": 82, "description": "Computer mouse",
    },
    "ewaste:charger_cable": {
        "mass_kg": 0.050, "volume_cm3": 30,
        "confidence_pct": 80, "description": "Phone charger cable",
    },
    "ewaste:circuit_board_small": {
        "mass_kg": 0.040, "volume_cm3": 50,
        "confidence_pct": 75, "description": "Small circuit board",
    },

    # ── TEXTILE ──
    "textile:tshirt": {
        "mass_kg": 0.200, "volume_cm3": 800,
        "confidence_pct": 72, "description": "Cotton T-shirt",
    },
    "textile:sock": {
        "mass_kg": 0.040, "volume_cm3": 100,
        "confidence_pct": 78, "description": "Single sock",
    },
    "textile:towel": {
        "mass_kg": 0.400, "volume_cm3": 2000,
        "confidence_pct": 68, "description": "Bath towel",
    },

    # ── RUBBER ──
    "rubber:tire_car": {
        "mass_kg": 10.0, "volume_cm3": 40000,
        "confidence_pct": 85, "description": "Car tire",
    },
    "rubber:rubber_band": {
        "mass_kg": 0.001, "volume_cm3": 1,
        "confidence_pct": 90, "description": "Rubber band",
    },
    "rubber:shoe_sole": {
        "mass_kg": 0.200, "volume_cm3": 300,
        "confidence_pct": 70, "description": "Shoe sole",
    },

    # ── WOOD ──
    "wood:chopsticks": {
        "mass_kg": 0.005, "volume_cm3": 8,
        "confidence_pct": 88, "description": "Wooden chopsticks (pair)",
    },
    "wood:popsicle_stick": {
        "mass_kg": 0.002, "volume_cm3": 3,
        "confidence_pct": 90, "description": "Popsicle stick",
    },
    "wood:plank_small": {
        "mass_kg": 0.500, "volume_cm3": 1000,
        "confidence_pct": 60, "description": "Small wood plank",
    },

    # ── MEDICAL ──
    "medical:syringe": {
        "mass_kg": 0.010, "volume_cm3": 15,
        "confidence_pct": 85, "description": "Disposable syringe",
    },
    "medical:face_mask": {
        "mass_kg": 0.004, "volume_cm3": 30,
        "confidence_pct": 88, "description": "Disposable face mask",
    },
    "medical:gloves_pair": {
        "mass_kg": 0.010, "volume_cm3": 50,
        "confidence_pct": 85, "description": "Pair of medical gloves",
    },
    "medical:bandage": {
        "mass_kg": 0.005, "volume_cm3": 15,
        "confidence_pct": 82, "description": "Used bandage",
    },
}


def lookup_known_object(
    waste_type: str,
    subtype: str | None = None,
    label: str | None = None,
    known_object_key: str | None = None,
) -> dict | None:
    """
    Try to match detected waste to a known object.

    Lookup priority:
      0. Direct key lookup (from CLIP classification)
      1. Exact "waste_type:subtype" key
      2. Exact "waste_type:label" key
      3. Fuzzy match on label words

    Returns dict with mass_kg, volume_cm3, confidence_pct, description
    or None if no match.
    """
    # Direct key lookup (highest priority — from CLIP)
    if known_object_key and known_object_key in KNOWN_OBJECTS:
        return KNOWN_OBJECTS[known_object_key]

    # Try exact subtype match
    if subtype:
        key = f"{waste_type}:{subtype}"
        if key in KNOWN_OBJECTS:
            return KNOWN_OBJECTS[key]

    # Try label match
    if label:
        key = f"{waste_type}:{label}"
        if key in KNOWN_OBJECTS:
            return KNOWN_OBJECTS[key]

    # Fuzzy: check if any known-object key starts with this waste_type
    # and if the label words appear in the description
    if label:
        label_lower = label.lower()
        candidates = []
        for k, v in KNOWN_OBJECTS.items():
            if not k.startswith(waste_type + ":"):
                continue
            desc = v["description"].lower()
            # Check if any word from label appears in description
            words = [w for w in label_lower.replace("_", " ").split() if len(w) > 2]
            matches = sum(1 for w in words if w in desc)
            if matches > 0:
                candidates.append((matches, v))
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            return candidates[0][1]

    return None


def get_typical_mass_for_type(waste_type: str) -> dict | None:
    """
    Return average mass across all known objects of this waste type.
    Useful as a last-resort estimate when specific object isn't identified.
    """
    masses = []
    for k, v in KNOWN_OBJECTS.items():
        if k.startswith(waste_type + ":"):
            masses.append(v["mass_kg"])

    if not masses:
        return None

    avg = sum(masses) / len(masses)
    return {
        "mass_kg": round(avg, 4),
        "volume_cm3": 0,  # unknown
        "confidence_pct": 45,
        "description": f"Average of {len(masses)} known {waste_type} items",
        "is_average": True,
    }
