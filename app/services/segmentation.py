"""
Segmentation Service — Object Mask Extraction.

Generates a binary mask for detected waste objects using multiple methods:
  1. GrabCut (OpenCV built-in) — uses bbox as prior → foreground mask
  2. Watershed segmentation — edge-based separation
  3. Simple threshold fallback — when above fails

Why segmentation instead of bounding box:
  - Bbox includes background pixels → inflates area by 30-60%
  - Mask gives precise object boundary → accurate area
  - Combined with depth map → proper volume estimation

For production: swap GrabCut with SAM (Segment Anything) or YOLOv8-seg.
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def extract_object_mask(
    image_bgr: np.ndarray,
    bbox: list[float] | list[int],
    method: str = "auto",
) -> tuple[np.ndarray, float, str]:
    """
    Extract a binary object mask from an image given a bounding box.

    Args:
        image_bgr: Full BGR image
        bbox: [x1, y1, x2, y2] bounding box
        method: "grabcut", "watershed", "threshold", or "auto" (tries all)

    Returns:
        (mask, mask_ratio, method_used)
        mask: HxW uint8 array (255 = object, 0 = background), same size as image
        mask_ratio: fraction of bbox that is foreground (0-1)
        method_used: which method succeeded
    """
    h, w = image_bgr.shape[:2]
    x1, y1, x2, y2 = [int(c) for c in bbox]
    x1 = max(0, min(x1, w - 1))
    y1 = max(0, min(y1, h - 1))
    x2 = max(x1 + 1, min(x2, w))
    y2 = max(y1 + 1, min(y2, h))

    bbox_w = x2 - x1
    bbox_h = y2 - y1

    if bbox_w < 10 or bbox_h < 10:
        # Bbox too small, return full bbox mask
        mask = np.zeros((h, w), dtype=np.uint8)
        mask[y1:y2, x1:x2] = 255
        return mask, 1.0, "bbox_fill"

    methods_to_try = []
    if method == "auto":
        methods_to_try = ["grabcut", "watershed", "threshold"]
    else:
        methods_to_try = [method]

    for m in methods_to_try:
        try:
            if m == "grabcut":
                mask, ratio = _grabcut_mask(image_bgr, x1, y1, x2, y2)
                if 0.15 < ratio < 0.95:
                    full_mask = np.zeros((h, w), dtype=np.uint8)
                    full_mask[y1:y2, x1:x2] = mask[y1:y2, x1:x2]
                    return full_mask, ratio, "grabcut"

            elif m == "watershed":
                mask, ratio = _watershed_mask(image_bgr, x1, y1, x2, y2)
                if 0.15 < ratio < 0.95:
                    full_mask = np.zeros((h, w), dtype=np.uint8)
                    full_mask[y1:y2, x1:x2] = mask[y1:y2, x1:x2]
                    return full_mask, ratio, "watershed"

            elif m == "threshold":
                mask, ratio = _threshold_mask(image_bgr, x1, y1, x2, y2)
                if 0.10 < ratio < 0.98:
                    full_mask = np.zeros((h, w), dtype=np.uint8)
                    full_mask[y1:y2, x1:x2] = mask[y1:y2, x1:x2]
                    return full_mask, ratio, "threshold"

        except Exception as e:
            logger.debug("Segmentation method %s failed: %s", m, e)
            continue

    # All methods failed — use 70% of bbox as elliptical mask
    mask = np.zeros((h, w), dtype=np.uint8)
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    ax, ay = bbox_w // 2, bbox_h // 2
    cv2.ellipse(mask, (cx, cy), (ax, ay), 0, 0, 360, 255, -1)
    ratio = float(np.sum(mask[y1:y2, x1:x2] > 0)) / (bbox_w * bbox_h)
    return mask, ratio, "ellipse_fallback"


def _grabcut_mask(
    image: np.ndarray, x1: int, y1: int, x2: int, y2: int
) -> tuple[np.ndarray, float]:
    """
    GrabCut segmentation — OpenCV's iterative graph-cut algorithm.
    Uses bounding box as initialization prior.
    """
    h, w = image.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    # GrabCut rect is (x, y, width, height)
    # Shrink bbox slightly to avoid edge artifacts
    margin = 3
    rect = (
        max(x1 + margin, 0),
        max(y1 + margin, 0),
        max(x2 - x1 - 2 * margin, 10),
        max(y2 - y1 - 2 * margin, 10),
    )

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    # Run GrabCut with 3 iterations (fast enough for real-time)
    cv2.grabCut(image, mask, rect, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_RECT)

    # Convert mask: 0=BG, 1=FG, 2=prob_BG, 3=prob_FG
    output_mask = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0
    ).astype(np.uint8)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    output_mask = cv2.morphologyEx(output_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    output_mask = cv2.morphologyEx(output_mask, cv2.MORPH_OPEN, kernel, iterations=1)

    bbox_area = (x2 - x1) * (y2 - y1)
    fg_area = float(np.sum(output_mask[y1:y2, x1:x2] > 0))
    ratio = fg_area / bbox_area if bbox_area > 0 else 0.0

    return output_mask, ratio


def _watershed_mask(
    image: np.ndarray, x1: int, y1: int, x2: int, y2: int
) -> tuple[np.ndarray, float]:
    """
    Watershed segmentation — marker-based approach.
    Center of bbox = definite foreground, edges = definite background.
    """
    crop = image[y1:y2, x1:x2].copy()
    ch, cw = crop.shape[:2]

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Noise removal
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)

    # Sure background = dilated foreground
    sure_bg = cv2.dilate(opening, kernel, iterations=3)

    # Sure foreground = eroded (distance transform)
    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist_transform, 0.5 * dist_transform.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)

    # Unknown region
    unknown = cv2.subtract(sure_bg, sure_fg)

    # Markers
    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1  # background = 1
    markers[unknown == 255] = 0  # unknown = 0

    cv2.watershed(crop, markers)

    # Foreground = all markers > 1
    output_mask = np.zeros_like(gray)
    output_mask[markers > 1] = 255

    # Morphological cleanup
    output_mask = cv2.morphologyEx(output_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    bbox_area = ch * cw
    fg_area = float(np.sum(output_mask > 0))
    ratio = fg_area / bbox_area if bbox_area > 0 else 0.0

    h, w = image.shape[:2]
    full_mask = np.zeros((h, w), dtype=np.uint8)
    full_mask[y1:y2, x1:x2] = output_mask
    return full_mask, ratio


def _threshold_mask(
    image: np.ndarray, x1: int, y1: int, x2: int, y2: int
) -> tuple[np.ndarray, float]:
    """
    Multi-threshold segmentation — combines Otsu and adaptive.
    Simpler but faster than GrabCut.
    """
    crop = image[y1:y2, x1:x2]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    ch, cw = gray.shape

    # Otsu threshold
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Adaptive threshold
    adaptive = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 8
    )

    # Combine: pixel is foreground if both agree
    combined = cv2.bitwise_and(otsu, adaptive)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)

    bbox_area = ch * cw
    fg_area = float(np.sum(combined > 0))
    ratio = fg_area / bbox_area if bbox_area > 0 else 0.0

    h, w = image.shape[:2]
    full_mask = np.zeros((h, w), dtype=np.uint8)
    full_mask[y1:y2, x1:x2] = combined
    return full_mask, ratio


def compute_mask_area_pixels(mask: np.ndarray) -> float:
    """Return the foreground area in pixels from a binary mask."""
    return float(np.sum(mask > 0))


def mask_bbox_ratio(mask: np.ndarray, bbox: list) -> float:
    """What fraction of the bbox is foreground in the mask."""
    x1, y1, x2, y2 = [int(c) for c in bbox]
    bbox_area = max((x2 - x1) * (y2 - y1), 1)
    fg = float(np.sum(mask[y1:y2, x1:x2] > 0))
    return fg / bbox_area
