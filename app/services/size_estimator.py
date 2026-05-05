"""
Size & Mass Estimator — Research-Grade Hybrid Pipeline.

Architecture:
  ┌─────────────────────────────────────────────────────┐
  │  Input: image + bbox + waste_type                   │
  │  ↓                                                  │
  │  Method 1: Manual Weight  (if provided)  → 95%      │
  │  ↓                                                  │
  │  Method 2: Known Object DB               → 60-90%   │
  │  ↓                                                  │
  │  Method 3: Segmentation + Depth + Ref    → 40-75%   │
  │  ↓                                                  │
  │  Method 4: Contour + Heuristic fallback  → 20-35%   │
  │  ↓                                                  │
  │  Sanity Clamp + Confidence Scoring                  │
  │  ↓                                                  │
  │  Output: mass_kg, volume, area, confidence, range   │
  └─────────────────────────────────────────────────────┘

The system cascades through methods 1→4, using the highest-confidence
estimate available.  When multiple methods produce results, they are
cross-validated (agreement boosts confidence, disagreement flags warnings).

This addresses the fundamental monocular scale-ambiguity problem:
  "Mass estimation is automatically performed using computer vision,
   but due to inherent scale ambiguity in monocular images, the system
   provides approximate values with confidence scoring."
"""
import json
import logging
import math
from pathlib import Path

import cv2
import numpy as np

from app.config import DATA_DIR, PIXELS_PER_CM

logger = logging.getLogger(__name__)

# ── Reference objects with known real-world dimensions ──
REFERENCE_OBJECTS = {
    "coin_inr":     {"name": "₹1 / ₹2 Coin",    "diameter_cm": 2.5},
    "coin_usd":     {"name": "US Quarter",        "diameter_cm": 2.426},
    "coin_eur":     {"name": "€1 Coin",           "diameter_cm": 2.325},
    "credit_card":  {"name": "Credit / ID Card",  "width_cm": 8.56, "height_cm": 5.398},
    "a4_paper":     {"name": "A4 Paper Sheet",    "width_cm": 21.0, "height_cm": 29.7},
}

# ── Typical mass ranges for waste objects (kg) — used for sanity clamping ──
TYPICAL_MASS_RANGES: dict[str, tuple[float, float]] = {
    "plastic":       (0.005, 2.0),
    "paper":         (0.005, 1.0),
    "metal":         (0.010, 10.0),
    "glass":         (0.050, 5.0),
    "organic":       (0.010, 5.0),
    "organic_food":  (0.010, 5.0),
    "organic_garden":(0.020, 10.0),
    "ewaste":        (0.020, 15.0),
    "textile":       (0.010, 5.0),
    "wood":          (0.050, 20.0),
    "rubber":        (0.020, 5.0),
    "medical":       (0.001, 2.0),
    "chemical":      (0.010, 5.0),
    "construction":  (0.100, 50.0),
    "composite":     (0.010, 3.0),
    "general_waste": (0.005, 5.0),
}

# ── Shape-based depth heuristic (fallback when no depth model) ──
_DEPTH_FACTORS: dict[str, float] = {
    "plastic":       0.30,
    "paper":         0.10,
    "metal":         0.35,
    "glass":         0.40,
    "organic":       0.50,
    "organic_food":  0.45,
    "organic_garden":0.55,
    "ewaste":        0.35,
    "textile":       0.20,
    "wood":          0.45,
    "rubber":        0.35,
    "medical":       0.25,
    "chemical":      0.30,
    "construction":  0.50,
    "composite":     0.30,
    "general_waste": 0.35,
}

# ── Data loading ────────────────────────────────────────
_waste_data: dict = {}


def _load_waste_data() -> dict:
    global _waste_data
    if not _waste_data:
        data_file = DATA_DIR / "waste_energy_data.json"
        with open(data_file, "r", encoding="utf-8") as f:
            _waste_data = json.load(f)
    return _waste_data


def get_waste_properties(waste_type: str, subtype: str | None = None) -> dict:
    """Look up properties for a waste type/subtype from the master data file."""
    data = _load_waste_data()
    category = data.get(waste_type, {})
    subtypes = category.get("subtypes", {})

    if subtype and subtype in subtypes:
        return subtypes[subtype]

    if subtypes:
        first_key = next(iter(subtypes))
        return subtypes[first_key]

    return {
        "density_kg_m3": 500,
        "energy_content_mj_kg": 10.0,
        "co2_landfill_factor": 1.0,
        "co2_conversion_factor": 0.3,
        "water_saved_per_kg_liters": 5.0,
        "methane_factor": 0.02,
        "leachate_factor": 0.5,
        "recyclable": False,
        "hazardous": False,
        "best_methods": ["incineration"],
        "method_efficiency": {
            "incineration": 0.25,
            "pyrolysis": 0.30,
            "biogas": 0.10,
            "gasification": 0.25,
            "plasma_arc": 0.35,
            "recycling_energy_saved_pct": 0.0,
        },
        "virgin_production_energy_mj_kg": 20.0,
    }


def get_subtypes_for_category(waste_type: str) -> list[dict]:
    data = _load_waste_data()
    category = data.get(waste_type, {})
    subtypes = category.get("subtypes", {})
    return [
        {"key": k, "name": v.get("name", k), "examples": v.get("examples", "")}
        for k, v in subtypes.items()
    ]


def get_all_categories() -> list[dict]:
    data = _load_waste_data()
    return [
        {
            "key": key,
            "display_name": cat.get("display_name", key),
            "icon": cat.get("icon", ""),
            "subtype_count": len(cat.get("subtypes", {})),
        }
        for key, cat in data.items()
    ]


# ═══════════════════════════════════════════════════════════
# REFERENCE OBJECT CALIBRATION
# ═══════════════════════════════════════════════════════════
def calibrate_from_reference(
    image_path: str,
    ref_type: str,
) -> float | None:
    """
    Detect a reference object (coin/card) and compute pixels_per_cm.
    Returns calibrated pixels_per_cm or None if not detected.
    """
    img = cv2.imread(image_path)
    if img is None:
        return None

    ref = REFERENCE_OBJECTS.get(ref_type)
    if ref is None:
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)

    if "diameter_cm" in ref:
        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=50,
            param1=100, param2=40, minRadius=15, maxRadius=300,
        )
        if circles is not None:
            circles = np.uint16(np.around(circles))
            best = circles[0][0]
            diameter_px = float(best[2]) * 2
            return diameter_px / ref["diameter_cm"]
    else:
        edges = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
            if len(approx) == 4:
                rect = cv2.minAreaRect(cnt)
                (_, (rw, rh), _) = rect
                if rw > 30 and rh > 30:
                    long_px = max(rw, rh)
                    long_cm = max(ref["width_cm"], ref["height_cm"])
                    return long_px / long_cm

    return None


# ═══════════════════════════════════════════════════════════
# MULTI-METHOD CONTOUR DETECTION (legacy, used by Method 4)
# ═══════════════════════════════════════════════════════════
def _detect_contour_area(crop: np.ndarray) -> tuple[float, str]:
    """
    Try 3 contour methods and return the best (median) result.
    Returns (pixel_area, method_used).
    """
    h, w = crop.shape[:2]
    bbox_area = float(h * w)
    results: list[tuple[float, str]] = []

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # Method 1: Canny edge detection
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        area = cv2.contourArea(max(contours, key=cv2.contourArea))
        if area > bbox_area * 0.05:
            results.append((area, "canny"))

    # Method 2: Adaptive threshold
    adaptive = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 8
    )
    adaptive = cv2.morphologyEx(adaptive, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours2, _ = cv2.findContours(adaptive, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours2:
        area2 = cv2.contourArea(max(contours2, key=cv2.contourArea))
        if area2 > bbox_area * 0.05:
            results.append((area2, "adaptive"))

    # Method 3: Otsu threshold
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    otsu = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours3, _ = cv2.findContours(otsu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours3:
        area3 = cv2.contourArea(max(contours3, key=cv2.contourArea))
        if area3 > bbox_area * 0.05:
            results.append((area3, "otsu"))

    if results:
        results.sort(key=lambda x: x[0])
        mid = len(results) // 2
        return results[mid]

    return (bbox_area * 0.65, "bbox_fallback")


# ═══════════════════════════════════════════════════════════
# MAIN HYBRID PIPELINE
# ═══════════════════════════════════════════════════════════
def estimate_size_and_mass(
    image_path: str,
    bbox: list[float],
    waste_type: str,
    subtype: str | None = None,
    manual_weight_kg: float | None = None,
    ref_type: str | None = None,
    pixels_per_cm: float = PIXELS_PER_CM,
    known_object_key: str | None = None,
) -> dict:
    """
    Hybrid multi-method mass estimation pipeline.

    Cascading priority:
      1. Manual weight (user input)       → confidence 95%
      2. Known object database lookup      → confidence 60-90%
      3. Segmentation + Depth + Reference  → confidence 40-75%
      4. Contour heuristic fallback        → confidence 20-35%

    Cross-validation: when multiple methods produce results, they are compared.
    Agreement within 2x → confidence boosted. Disagreement → warning emitted.

    Returns dict with area_cm2, volume_m3, mass_kg, estimation_method,
    estimation_details, confidence_level, confidence_pct, mass_range, warnings.
    """
    warnings: list[str] = []
    estimation_details: dict = {}
    method_estimates: list[dict] = []  # for cross-validation

    # ════════════════════════════════════════════════════════
    # METHOD 1: Manual Weight — highest accuracy, bypass all
    # ════════════════════════════════════════════════════════
    if manual_weight_kg is not None and manual_weight_kg > 0:
        props = get_waste_properties(waste_type, subtype)
        density = props.get("density_kg_m3", 500)
        vol_m3 = manual_weight_kg / density if density > 0 else 0.0005
        return {
            "area_cm2": 0.0,
            "volume_m3": round(vol_m3, 6),
            "mass_kg": round(manual_weight_kg, 4),
            "estimation_method": "manual_weight",
            "estimation_details": {"source": "User-provided weight (scale measurement)"},
            "confidence_level": "high",
            "confidence_pct": 95,
            "mass_range": {
                "min_kg": round(manual_weight_kg * 0.95, 4),
                "max_kg": round(manual_weight_kg * 1.05, 4),
            },
            "warnings": [],
        }

    # Load image
    img = cv2.imread(image_path)
    if img is None:
        result = _fallback_estimate(waste_type, subtype)
        result["warnings"] = ["Could not read image — using default estimates"]
        return result

    # ════════════════════════════════════════════════════════
    # METHOD 2: Known Object Database
    # ════════════════════════════════════════════════════════
    known_result = None
    try:
        from app.services.known_objects import lookup_known_object, get_typical_mass_for_type
        known_result = lookup_known_object(waste_type, subtype, known_object_key=known_object_key)
        if known_result is None:
            known_result = get_typical_mass_for_type(waste_type)
    except Exception as e:
        logger.debug("Known object lookup failed: %s", e)

    if known_result:
        method_estimates.append({
            "method": "known_object_db",
            "mass_kg": known_result["mass_kg"],
            "confidence_pct": known_result["confidence_pct"],
            "description": known_result.get("description", ""),
        })
        estimation_details["known_object"] = known_result.get("description", "matched")

    # ════════════════════════════════════════════════════════
    # METHOD 2b: Bbox-Size Mass Estimation
    # ════════════════════════════════════════════════════════
    # Uses bounding box pixel area scaled against a reference area per waste type.
    # Reference: typical object of this waste type occupies ~200×200 px in a phone photo.
    _BBOX_REF_AREA_PX = 40_000.0  # 200×200 px — reference bbox area for "average" item
    _BBOX_REF_MASS: dict[str, float] = {
        "plastic": 0.025, "paper": 0.020, "metal": 0.060,
        "glass": 0.250, "organic": 0.100, "ewaste": 0.300,
        "textile": 0.150, "wood": 0.300, "rubber": 0.150,
        "medical": 0.015, "general_waste": 0.050,
    }
    bbox_w = max(1, abs(bbox[2] - bbox[0]))
    bbox_h = max(1, abs(bbox[3] - bbox[1]))
    bbox_area = bbox_w * bbox_h
    if bbox_area > 100:
        ref_mass = _BBOX_REF_MASS.get(waste_type, 0.050)
        scale = bbox_area / _BBOX_REF_AREA_PX
        bbox_mass = ref_mass * min(max(scale, 0.1), 10.0)  # clamp 0.1x-10x
        lo, hi = TYPICAL_MASS_RANGES.get(waste_type, (0.005, 5.0))
        bbox_mass = max(lo, min(bbox_mass, hi))
        method_estimates.append({
            "method": "bbox_size",
            "mass_kg": bbox_mass,
            "confidence_pct": 30,
            "area_cm2": bbox_area / (pixels_per_cm ** 2),
        })
        estimation_details["bbox_size"] = f"bbox {bbox_w:.0f}×{bbox_h:.0f}px → scale {scale:.2f}x → {bbox_mass:.4f} kg"

    # ════════════════════════════════════════════════════════
    # METHOD 3: Segmentation + Depth + Reference Calibration
    # ════════════════════════════════════════════════════════
    effective_ppc = pixels_per_cm
    calibration_source = "default_scale"

    if ref_type:
        cal = calibrate_from_reference(image_path, ref_type)
        if cal is not None and cal > 1.0:
            effective_ppc = cal
            calibration_source = f"reference_{ref_type}"
            estimation_details["calibration"] = f"Reference object: {ref_type} → {cal:.1f} px/cm"
        else:
            warnings.append(f"Reference object '{ref_type}' not detected — using default scale")

    x1, y1, x2, y2 = [int(c) for c in bbox]
    h_img, w_img = img.shape[:2]
    x1, y1 = max(0, min(x1, w_img - 1)), max(0, min(y1, h_img - 1))
    x2, y2 = max(x1 + 1, min(x2, w_img)), max(y1 + 1, min(y2, h_img))

    # --- 3a. Segmentation mask ---
    seg_method = "none"
    mask = None
    mask_area_px = 0.0

    try:
        from app.services.segmentation import extract_object_mask, compute_mask_area_pixels
        mask, mask_ratio, seg_method = extract_object_mask(img, [x1, y1, x2, y2])
        mask_area_px = compute_mask_area_pixels(mask)
        estimation_details["segmentation"] = {
            "method": seg_method,
            "mask_ratio": round(mask_ratio, 3),
            "mask_area_px": round(mask_area_px, 0),
        }
    except Exception as e:
        logger.debug("Segmentation failed: %s", e)

    # --- 3b. Depth estimation ---
    depth_map = None
    depth_mode = "none"
    depth_volume_cm3 = None

    try:
        from app.services.depth_estimator import estimate_depth_map, estimate_volume_from_depth
        depth_map, depth_mode = estimate_depth_map(img)
        estimation_details["depth_model"] = depth_mode

        if depth_map is not None and mask is not None and mask_area_px > 100:
            depth_volume_cm3, depth_conf_boost, vol_method = estimate_volume_from_depth(
                depth_map, mask, effective_ppc, waste_type
            )
            estimation_details["depth_volume"] = {
                "volume_cm3": round(depth_volume_cm3, 2),
                "method": vol_method,
                "confidence_boost": depth_conf_boost,
            }
    except Exception as e:
        logger.debug("Depth estimation failed: %s", e)

    # --- 3c. Compute mass from segmentation + depth ---
    props = get_waste_properties(waste_type, subtype)
    density = props.get("density_kg_m3", 500)

    if mask is not None and mask_area_px > 100:
        area_cm2_seg = mask_area_px / (effective_ppc ** 2)
        area_cm2_seg = max(area_cm2_seg, 1.0)

        if depth_volume_cm3 is not None and depth_volume_cm3 > 0:
            # Best case: segmentation + depth
            volume_m3_seg = depth_volume_cm3 / 1_000_000
            mass_seg = volume_m3_seg * density
            seg_conf = 55 if calibration_source == "default_scale" else 70
            if depth_mode != "none":
                seg_conf += 10

            method_estimates.append({
                "method": "segmentation_depth",
                "mass_kg": mass_seg,
                "confidence_pct": seg_conf,
                "area_cm2": area_cm2_seg,
                "volume_cm3": depth_volume_cm3,
            })
        else:
            # Segmentation mask without depth → use shape heuristic for depth
            depth_factor = _DEPTH_FACTORS.get(waste_type, 0.35)
            depth_cm = math.sqrt(area_cm2_seg) * depth_factor
            vol_cm3 = area_cm2_seg * depth_cm
            volume_m3_seg = vol_cm3 / 1_000_000
            mass_seg = volume_m3_seg * density
            seg_conf = 40 if calibration_source == "default_scale" else 60

            method_estimates.append({
                "method": "segmentation_heuristic",
                "mass_kg": mass_seg,
                "confidence_pct": seg_conf,
                "area_cm2": area_cm2_seg,
                "volume_cm3": vol_cm3,
            })

    # ════════════════════════════════════════════════════════
    # METHOD 4: Contour + Heuristic Fallback (legacy)
    # ════════════════════════════════════════════════════════
    crop = img[y1:y2, x1:x2]
    pixel_area, contour_method = _detect_contour_area(crop)

    area_cm2_contour = pixel_area / (effective_ppc ** 2)
    area_cm2_contour = max(area_cm2_contour, 1.0)

    depth_factor = _DEPTH_FACTORS.get(waste_type, 0.35)
    depth_cm = math.sqrt(area_cm2_contour) * depth_factor
    vol_cm3_contour = area_cm2_contour * depth_cm
    mass_contour = (vol_cm3_contour / 1_000_000) * density

    contour_conf = 25
    if calibration_source != "default_scale":
        contour_conf = 40
    if contour_method == "bbox_fallback":
        contour_conf -= 10

    method_estimates.append({
        "method": f"contour_{contour_method}",
        "mass_kg": mass_contour,
        "confidence_pct": contour_conf,
        "area_cm2": area_cm2_contour,
        "volume_cm3": vol_cm3_contour,
    })

    # ════════════════════════════════════════════════════════
    # CROSS-VALIDATION & FINAL SELECTION
    # ════════════════════════════════════════════════════════
    if not method_estimates:
        result = _fallback_estimate(waste_type, subtype)
        result["warnings"] = warnings + result.get("warnings", [])
        return result

    # Sort by confidence (highest first)
    method_estimates.sort(key=lambda x: x["confidence_pct"], reverse=True)
    best = method_estimates[0]

    # Cross-validation: compare top 2 methods
    if len(method_estimates) >= 2:
        second = method_estimates[1]
        ratio = best["mass_kg"] / second["mass_kg"] if second["mass_kg"] > 0 else 999
        if 0.5 <= ratio <= 2.0:
            # Methods agree (within 2x) → boost confidence
            best["confidence_pct"] = min(best["confidence_pct"] + 8, 92)
            estimation_details["cross_validation"] = (
                f"✓ Agreement between {best['method']} and {second['method']} "
                f"(ratio: {ratio:.2f}) — confidence boosted"
            )
        else:
            # Methods disagree → warn
            warnings.append(
                f"Estimation methods disagree: {best['method']}={best['mass_kg']:.4f} kg vs "
                f"{second['method']}={second['mass_kg']:.4f} kg. "
                f"Consider using manual weight for accuracy."
            )
            estimation_details["cross_validation"] = (
                f"✗ Disagreement (ratio: {ratio:.2f}) — treat estimates with caution"
            )

    # Extract final values
    mass_kg = best["mass_kg"]
    conf_pct = best["confidence_pct"]
    estimation_method = best["method"]
    area_cm2 = best.get("area_cm2", area_cm2_contour)
    volume_cm3 = best.get("volume_cm3", vol_cm3_contour)
    volume_m3 = volume_cm3 / 1_000_000

    # Sanity clamp
    lo, hi = TYPICAL_MASS_RANGES.get(waste_type, (0.005, 5.0))
    if mass_kg < lo * 0.1:
        warnings.append(f"Estimated mass ({mass_kg:.4f} kg) unusually low — clamped to typical minimum")
        mass_kg = lo
        conf_pct = min(conf_pct, 25)
    elif mass_kg > hi * 3:
        warnings.append(f"Estimated mass ({mass_kg:.2f} kg) unusually high — clamped to typical maximum")
        mass_kg = hi
        conf_pct = min(conf_pct, 25)

    mass_kg = max(0.001, mass_kg)

    # Confidence tier
    if conf_pct >= 70:
        conf_level = "high"
    elif conf_pct >= 50:
        conf_level = "medium"
    elif conf_pct >= 30:
        conf_level = "low"
    else:
        conf_level = "very_low"
        if not any("manual weight" in w.lower() for w in warnings):
            warnings.append("Estimation is unreliable (scale ambiguity). Strongly recommend entering manual weight.")

    # Error margin
    if conf_pct >= 70:
        margin = 0.20
    elif conf_pct >= 50:
        margin = 0.30
    elif conf_pct >= 30:
        margin = 0.45
    else:
        margin = 0.60

    # Build all-methods summary (for transparency)
    all_methods_summary = [
        {"method": m["method"], "mass_kg": round(m["mass_kg"], 4), "confidence_pct": m["confidence_pct"]}
        for m in method_estimates
    ]

    return {
        "area_cm2": round(area_cm2, 2),
        "volume_m3": round(volume_m3, 6),
        "mass_kg": round(mass_kg, 4),
        "estimation_method": estimation_method,
        "estimation_details": estimation_details,
        "all_methods": all_methods_summary,
        "confidence_level": conf_level,
        "confidence_pct": conf_pct,
        "mass_range": {
            "min_kg": round(mass_kg * (1 - margin), 4),
            "max_kg": round(mass_kg * (1 + margin), 4),
        },
        "warnings": warnings,
    }


def _fallback_estimate(waste_type: str, subtype: str | None = None) -> dict:
    """Return a reasonable default estimate when image can't be read."""
    props = get_waste_properties(waste_type, subtype)
    density = props.get("density_kg_m3", 500)
    volume_cm3 = 500.0
    volume_m3 = volume_cm3 / 1_000_000
    mass_kg = volume_m3 * density
    lo, hi = TYPICAL_MASS_RANGES.get(waste_type, (0.005, 5.0))
    mass_kg = max(lo, min(mass_kg, hi))
    return {
        "area_cm2": 100.0,
        "volume_m3": round(volume_m3, 6),
        "mass_kg": round(mass_kg, 4),
        "estimation_method": "fallback",
        "estimation_details": {"source": "Category-based default (no image analysis)"},
        "all_methods": [],
        "confidence_level": "very_low",
        "confidence_pct": 15,
        "mass_range": {
            "min_kg": round(mass_kg * 0.3, 4),
            "max_kg": round(mass_kg * 2.0, 4),
        },
        "warnings": ["Image unreadable — using category-based default estimate"],
    }
