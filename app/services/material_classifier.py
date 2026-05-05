"""
Material Classifier — OpenCV-based waste material identification.

Runs on the CROPPED object region (from YOLO bbox) and determines the
ACTUAL waste material using visual features:
  - Color histogram analysis (HSV)
  - Transparency / translucency detection
  - Texture analysis (LBP-like variance)
  - Shininess / specular highlight detection
  - Edge density analysis

Combined with COCO class name for a hybrid approach:
  YOLO detects WHAT the object is (bottle, laptop, banana)
  Material classifier detects WHAT it's MADE of (plastic, glass, metal)

This fixes the core problem: COCO model knows "bottle" but not "plastic".
"""
import logging
import cv2
import numpy as np

logger = logging.getLogger(__name__)

# COCO class → possible materials (ordered by likelihood)
COCO_MATERIAL_HINTS: dict[str, list[str]] = {
    # Containers — could be plastic, glass, or metal
    "bottle": ["plastic", "glass"],
    "wine glass": ["glass"],
    "cup": ["plastic", "paper", "glass"],
    "bowl": ["plastic", "glass", "ceramic"],
    "vase": ["glass", "ceramic"],
    # Utensils
    "fork": ["metal", "plastic"],
    "knife": ["metal"],
    "spoon": ["metal", "plastic"],
    "scissors": ["metal"],
    # Food — always organic
    "banana": ["organic"], "apple": ["organic"], "sandwich": ["organic"],
    "orange": ["organic"], "broccoli": ["organic"], "carrot": ["organic"],
    "hot dog": ["organic"], "pizza": ["organic"], "donut": ["organic"],
    "cake": ["organic"],
    # Electronics
    "tv": ["ewaste"], "laptop": ["ewaste"], "mouse": ["ewaste"],
    "remote": ["ewaste"], "keyboard": ["ewaste"], "cell phone": ["ewaste"],
    "microwave": ["ewaste"], "oven": ["ewaste"], "toaster": ["ewaste"],
    "refrigerator": ["ewaste"], "hair drier": ["ewaste"],
    # Textiles / Bags
    "backpack": ["textile"], "umbrella": ["textile", "plastic"],
    "handbag": ["textile"], "tie": ["textile"], "suitcase": ["textile", "plastic"],
    # Furniture
    "chair": ["wood", "metal", "plastic"],
    "couch": ["textile", "wood"],
    "bed": ["textile", "wood"],
    "dining table": ["wood", "metal"],
    # Sports
    "sports ball": ["rubber"], "frisbee": ["plastic"],
    "kite": ["plastic", "textile"],
    "baseball bat": ["wood", "metal"],
    "baseball glove": ["textile"],
    "skateboard": ["wood"], "surfboard": ["plastic"],
    "tennis racket": ["composite"],
    "skis": ["composite"], "snowboard": ["composite"],
    # Misc
    "clock": ["ewaste", "plastic"],
    "potted plant": ["organic"],
    "toilet": ["ceramic"], "sink": ["ceramic"],
    "toothbrush": ["plastic"],
    "book": ["paper"],
    # Vehicles / outdoor
    "bicycle": ["metal"], "car": ["metal"], "motorcycle": ["metal"],
    "bus": ["metal"], "truck": ["metal"], "boat": ["metal"],
    "traffic light": ["ewaste"], "fire hydrant": ["metal"],
    "stop sign": ["metal"], "parking meter": ["metal"],
    "bench": ["wood", "metal"],
}


def classify_material(image: np.ndarray, coco_class: str = "") -> dict:
    """
    Classify waste material from a cropped object image.

    Args:
        image: BGR numpy array (cropped to object region)
        coco_class: COCO class name from YOLO (e.g. "bottle")

    Returns:
        {
            "waste_type": "plastic",
            "material_confidence": 0.82,
            "method": "hybrid_coco_visual",
            "scores": {"plastic": 0.82, "glass": 0.10, ...},
            "visual_features": {...}
        }
    """
    if image is None or image.size == 0:
        return _fallback(coco_class)

    # Ensure minimum size
    h, w = image.shape[:2]
    if h < 10 or w < 10:
        return _fallback(coco_class)

    # Extract visual features
    features = _extract_features(image)

    # Score each material based on visual features
    visual_scores = _score_materials(features)

    # Get COCO hint scores
    coco_scores = _coco_hint_scores(coco_class)

    # Combine: visual (60%) + COCO hint (40%)
    # If COCO class is food/organic/ewaste, trust it more (80%)
    high_trust_types = {"organic", "ewaste"}
    coco_primary = coco_scores.get(max(coco_scores, key=coco_scores.get, default=""), 0)

    if coco_class and coco_primary > 0 and max(coco_scores, key=coco_scores.get) in high_trust_types:
        alpha = 0.2  # visual weight low, trust COCO more
    elif coco_class and coco_primary > 0:
        alpha = 0.6  # normal: visual dominant
    else:
        alpha = 1.0  # no COCO hint: visual only

    combined = {}
    all_types = set(list(visual_scores.keys()) + list(coco_scores.keys()))
    for t in all_types:
        vs = visual_scores.get(t, 0)
        cs = coco_scores.get(t, 0)
        combined[t] = alpha * vs + (1 - alpha) * cs

    # Normalize
    total = sum(combined.values())
    if total > 0:
        combined = {k: round(v / total, 4) for k, v in combined.items()}

    best_type = max(combined, key=combined.get) if combined else "general_waste"
    best_conf = combined.get(best_type, 0)

    method = "visual_only"
    if coco_class and alpha < 1.0:
        method = "hybrid_coco_visual"

    return {
        "waste_type": best_type,
        "material_confidence": round(best_conf, 3),
        "method": method,
        "scores": combined,
        "visual_features": features,
    }


def _extract_features(image: np.ndarray) -> dict:
    """Extract color, texture, and shape features from the image."""
    h, w = image.shape[:2]

    # Resize for consistent analysis
    analysis = cv2.resize(image, (128, 128))

    # Convert color spaces
    hsv = cv2.cvtColor(analysis, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(analysis, cv2.COLOR_BGR2GRAY)

    # --- Color features ---
    h_mean, s_mean, v_mean = hsv.mean(axis=(0, 1))
    h_std, s_std, v_std = hsv.std(axis=(0, 1))
    b_mean, g_mean, r_mean = analysis.mean(axis=(0, 1))

    # Dominant color histogram (H channel)
    h_hist = cv2.calcHist([hsv], [0], None, [18], [0, 180]).flatten()
    h_hist = h_hist / (h_hist.sum() + 1e-6)

    # --- Transparency / translucency ---
    # High value + low saturation = transparent/translucent
    translucency = float(np.mean((hsv[:, :, 2] > 180) & (hsv[:, :, 1] < 50)))

    # --- Shininess (specular highlights) ---
    bright_pixels = float(np.mean(gray > 230))
    # Laplacian for highlight edges
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    highlight_variance = float(np.var(lap))

    # --- Texture analysis ---
    # Edge density (Canny)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.mean(edges > 0))

    # Texture uniformity (local variance)
    local_mean = cv2.blur(gray.astype(np.float32), (7, 7))
    local_var = cv2.blur((gray.astype(np.float32) - local_mean) ** 2, (7, 7))
    texture_variance = float(np.mean(local_var))

    # --- Color uniformity ---
    color_std = float(np.mean([s_std, v_std]))

    # --- Brown/Green/Grey dominance ---
    # Brown: H 10-25, S > 50
    brown_mask = (hsv[:, :, 0] >= 10) & (hsv[:, :, 0] <= 25) & (hsv[:, :, 1] > 50)
    brown_ratio = float(np.mean(brown_mask))

    # Green: H 35-85
    green_mask = (hsv[:, :, 0] >= 35) & (hsv[:, :, 0] <= 85) & (hsv[:, :, 1] > 30)
    green_ratio = float(np.mean(green_mask))

    # Grey/Silver: low saturation, medium value
    grey_mask = (hsv[:, :, 1] < 40) & (hsv[:, :, 2] > 80) & (hsv[:, :, 2] < 220)
    grey_ratio = float(np.mean(grey_mask))

    # Blue: common for plastic bags/bottles
    blue_mask = (hsv[:, :, 0] >= 90) & (hsv[:, :, 0] <= 130) & (hsv[:, :, 1] > 30)
    blue_ratio = float(np.mean(blue_mask))

    # White: paper, styrofoam
    white_mask = (hsv[:, :, 1] < 30) & (hsv[:, :, 2] > 200)
    white_ratio = float(np.mean(white_mask))

    return {
        "h_mean": round(float(h_mean), 1),
        "s_mean": round(float(s_mean), 1),
        "v_mean": round(float(v_mean), 1),
        "translucency": round(translucency, 3),
        "shininess": round(bright_pixels, 3),
        "highlight_var": round(highlight_variance, 1),
        "edge_density": round(edge_density, 3),
        "texture_variance": round(texture_variance, 1),
        "color_std": round(color_std, 1),
        "brown_ratio": round(brown_ratio, 3),
        "green_ratio": round(green_ratio, 3),
        "grey_ratio": round(grey_ratio, 3),
        "blue_ratio": round(blue_ratio, 3),
        "white_ratio": round(white_ratio, 3),
    }


def _score_materials(f: dict) -> dict:
    """Score each waste material type based on visual features."""
    scores: dict[str, float] = {}

    # PLASTIC: translucent, smooth, colored (blue/clear), low texture
    scores["plastic"] = (
        0.25 * f["translucency"]
        + 0.15 * max(0, 1 - f["edge_density"] * 3)  # smooth = low edges
        + 0.15 * f["blue_ratio"]
        + 0.10 * max(0, 1 - f["texture_variance"] / 500)
        + 0.10 * f["shininess"]
        + 0.05 * max(0, f["s_mean"] / 255)  # some color saturation
        + 0.05
    )

    # GLASS: very shiny, translucent, specular highlights, green/clear
    scores["glass"] = (
        0.30 * f["translucency"]
        + 0.20 * f["shininess"]
        + 0.15 * min(1, f["highlight_var"] / 2000)
        + 0.10 * f["green_ratio"]
        + 0.05 * max(0, 1 - f["edge_density"] * 2)
    )

    # METAL: grey/silver, very shiny, high highlight variance
    scores["metal"] = (
        0.30 * f["grey_ratio"]
        + 0.25 * f["shininess"]
        + 0.20 * min(1, f["highlight_var"] / 3000)
        + 0.10 * max(0, 1 - f["s_mean"] / 100)  # low saturation
        + 0.05
    )

    # PAPER: white/light, low shininess, medium texture, uniform
    scores["paper"] = (
        0.30 * f["white_ratio"]
        + 0.20 * max(0, 1 - f["shininess"] * 3)  # not shiny
        + 0.15 * max(0, 1 - f["texture_variance"] / 500)
        + 0.10 * max(0, f["v_mean"] / 255)  # bright
        + 0.05 * max(0, 1 - f["s_mean"] / 100)
    )

    # ORGANIC: brown/green, high texture, irregular
    scores["organic"] = (
        0.25 * f["brown_ratio"]
        + 0.25 * f["green_ratio"]
        + 0.15 * min(1, f["texture_variance"] / 1000)
        + 0.10 * min(1, f["edge_density"] * 2)
        + 0.05 * min(1, f["color_std"] / 50)
    )

    # TEXTILE: high texture, colorful, not shiny
    scores["textile"] = (
        0.25 * min(1, f["texture_variance"] / 800)
        + 0.20 * min(1, f["edge_density"] * 3)
        + 0.15 * max(0, f["s_mean"] / 200)
        + 0.10 * max(0, 1 - f["shininess"] * 3)
        + 0.05 * min(1, f["color_std"] / 40)
    )

    # WOOD: brown, textured, not shiny
    scores["wood"] = (
        0.35 * f["brown_ratio"]
        + 0.20 * min(1, f["texture_variance"] / 600)
        + 0.15 * max(0, 1 - f["shininess"] * 3)
        + 0.10 * min(1, f["edge_density"] * 2)
    )

    # EWASTE: mixed colors, circuit board patterns, complex edges
    scores["ewaste"] = (
        0.25 * min(1, f["edge_density"] * 4)
        + 0.20 * min(1, f["color_std"] / 60)
        + 0.15 * min(1, f["texture_variance"] / 1500)
        + 0.10 * f["green_ratio"]  # PCB green
    )

    # RUBBER: dark, smooth, not shiny
    scores["rubber"] = (
        0.30 * max(0, 1 - f["v_mean"] / 150)  # dark
        + 0.20 * max(0, 1 - f["shininess"] * 3)
        + 0.15 * max(0, 1 - f["s_mean"] / 100)
        + 0.10 * max(0, 1 - f["edge_density"] * 2)
    )

    # Clamp all scores >= 0
    return {k: max(0, v) for k, v in scores.items()}


def _coco_hint_scores(coco_class: str) -> dict:
    """Convert COCO class name to material likelihood scores."""
    hints = COCO_MATERIAL_HINTS.get(coco_class.lower().strip(), [])
    if not hints:
        return {}

    scores = {}
    n = len(hints)
    for i, material in enumerate(hints):
        # First hint gets highest score, decreasing
        scores[material] = (n - i) / n
    return scores


def _fallback(coco_class: str) -> dict:
    """Fallback when image is unavailable."""
    coco_scores = _coco_hint_scores(coco_class)
    if coco_scores:
        best = max(coco_scores, key=coco_scores.get)
        return {
            "waste_type": best,
            "material_confidence": round(coco_scores[best], 3),
            "method": "coco_hint_only",
            "scores": coco_scores,
            "visual_features": {},
        }
    return {
        "waste_type": "general_waste",
        "material_confidence": 0.1,
        "method": "fallback",
        "scores": {},
        "visual_features": {},
    }
