"""
Monocular Depth Estimation Service — MiDaS / DPT.

Uses MiDaS (Intel ISL) to generate a relative depth map from a single image.
The depth map alone cannot give absolute distances (monocular scale ambiguity),
but combined with a known reference object or segmentation mask it enables
significantly better volume estimation than pure 2-D pixel heuristics.

Fallback: if MiDaS is unavailable, produces a flat depth estimate from bbox size.

Models (auto-selected):
  1. MiDaS v2.1 small (midas_v21_small_256) — ~17 MB, ~40 ms on CPU
  2. DPT-Hybrid                                — ~120 MB, ~120 ms on CPU
  3. Flat fallback (no ML)                     — instant
"""
from __future__ import annotations

import logging
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_midas_model = None
_midas_transform = None
_midas_device = None
_midas_mode: str = "none"  # "midas_small", "dpt_hybrid", "none"


def _load_midas() -> str:
    """
    Lazy-load MiDaS model.  Returns mode string.
    Uses torch.hub which auto-downloads weights on first call (~17 MB for small).
    """
    global _midas_model, _midas_transform, _midas_device, _midas_mode
    if _midas_mode != "none":
        return _midas_mode

    try:
        import torch
        _midas_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Try small model first (fast & lightweight)
        try:
            _midas_model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small", trust_repo=True)
            _midas_model.to(_midas_device).eval()
            midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
            _midas_transform = midas_transforms.small_transform
            _midas_mode = "midas_small"
            logger.info("MiDaS small model loaded successfully")
            return _midas_mode
        except Exception as e1:
            logger.warning("MiDaS small failed (%s), trying DPT-Hybrid…", e1)

        # Try DPT-Hybrid as second choice
        try:
            _midas_model = torch.hub.load("intel-isl/MiDaS", "DPT_Hybrid", trust_repo=True)
            _midas_model.to(_midas_device).eval()
            midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
            _midas_transform = midas_transforms.dpt_transform
            _midas_mode = "dpt_hybrid"
            logger.info("DPT-Hybrid model loaded successfully")
            return _midas_mode
        except Exception as e2:
            logger.warning("DPT-Hybrid also failed: %s", e2)

    except ImportError:
        logger.warning("torch not installed — depth estimation disabled")

    _midas_mode = "none"
    return _midas_mode


def estimate_depth_map(image_bgr: np.ndarray) -> tuple[np.ndarray | None, str]:
    """
    Produce a relative depth map for the given BGR image.

    Returns:
        (depth_map, mode)
        depth_map: HxW float32 array with relative inverse-depth values.
                   Higher value = closer to camera.
                   None if model unavailable.
        mode: "midas_small", "dpt_hybrid", or "none"
    """
    mode = _load_midas()
    if mode == "none" or _midas_model is None or _midas_transform is None:
        return None, "none"

    import torch

    img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    input_batch = _midas_transform(img_rgb).to(_midas_device)

    with torch.no_grad():
        prediction = _midas_model(input_batch)
        # Resize to original image dimensions
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=image_bgr.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth_map = prediction.cpu().numpy().astype(np.float32)
    # Normalize to 0-1 range
    d_min, d_max = depth_map.min(), depth_map.max()
    if d_max - d_min > 1e-6:
        depth_map = (depth_map - d_min) / (d_max - d_min)
    else:
        depth_map = np.ones_like(depth_map) * 0.5

    return depth_map, mode


def compute_object_depth_stats(
    depth_map: np.ndarray,
    mask: np.ndarray,
) -> dict:
    """
    Given a depth map and binary object mask, compute depth statistics
    for the object region.

    Returns:
        {
            "mean_depth": float (0-1, higher = closer),
            "std_depth": float,
            "min_depth": float,
            "max_depth": float,
            "depth_range": float (max-min within object),
            "relative_volume_score": float,
        }
    """
    object_depths = depth_map[mask > 0]
    if len(object_depths) == 0:
        return {
            "mean_depth": 0.5, "std_depth": 0.0,
            "min_depth": 0.5, "max_depth": 0.5,
            "depth_range": 0.0, "relative_volume_score": 0.0,
        }

    mean_d = float(np.mean(object_depths))
    std_d = float(np.std(object_depths))
    min_d = float(np.min(object_depths))
    max_d = float(np.max(object_depths))
    depth_range = max_d - min_d

    # Relative volume score: sum of (depth - background_depth) for each pixel
    # Approximates how "thick" the object is relative to the background
    bg_depths = depth_map[mask == 0]
    bg_mean = float(np.mean(bg_depths)) if len(bg_depths) > 0 else 0.0

    # Object pixels closer to camera have higher depth values (inverse depth)
    thickness_per_pixel = np.clip(object_depths - bg_mean, 0, None)
    relative_volume_score = float(np.sum(thickness_per_pixel))

    return {
        "mean_depth": round(mean_d, 4),
        "std_depth": round(std_d, 4),
        "min_depth": round(min_d, 4),
        "max_depth": round(max_d, 4),
        "depth_range": round(depth_range, 4),
        "relative_volume_score": round(relative_volume_score, 2),
    }


def estimate_volume_from_depth(
    depth_map: np.ndarray | None,
    mask: np.ndarray,
    pixels_per_cm: float,
    waste_type: str,
) -> tuple[float, float, str]:
    """
    Estimate object volume (cm³) using depth map + segmentation mask.

    If no depth map is available, falls back to shape-based heuristic.

    Returns:
        (volume_cm3, confidence_boost, method)
        confidence_boost: how much extra confidence this adds (0-25)
    """
    from app.services.size_estimator import _DEPTH_FACTORS

    mask_area_px = float(np.sum(mask > 0))
    area_cm2 = mask_area_px / (pixels_per_cm ** 2)
    area_cm2 = max(area_cm2, 1.0)

    if depth_map is not None and mask_area_px > 100:
        stats = compute_object_depth_stats(depth_map, mask)

        # Use depth range within object as a proxy for actual thickness
        # Scale by area to get volume
        depth_range = stats["depth_range"]
        mean_depth = stats["mean_depth"]

        # The depth_range tells us relative thickness.
        # Scale it: if depth_range is 0.3 and area is 100cm², thickness ≈ sqrt(area)*depth_range
        # This is a heuristic that works well for typical waste objects
        estimated_thickness_cm = max(
            depth_range * np.sqrt(area_cm2) * 2.0,
            0.5  # minimum 5mm thickness
        )

        # Cap thickness to reasonable bounds
        max_thickness = np.sqrt(area_cm2) * 0.8  # can't be thicker than it is wide
        estimated_thickness_cm = min(estimated_thickness_cm, max_thickness)

        volume_cm3 = area_cm2 * estimated_thickness_cm
        confidence_boost = 15.0  # depth adds 15% confidence
        method = "depth_map"

        return volume_cm3, confidence_boost, method

    # Fallback: shape-based heuristic (same as before)
    depth_factor = _DEPTH_FACTORS.get(waste_type, 0.35)
    depth_cm = np.sqrt(area_cm2) * depth_factor
    volume_cm3 = area_cm2 * depth_cm
    return volume_cm3, 0.0, "shape_heuristic"
