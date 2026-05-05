"""
AI Waste Classifier — CLIP Zero-Shot + YOLO Hybrid Pipeline.

Classification: CLIP ViT-B-32 zero-shot (61 waste-specific prompts)
Bbox detection:  YOLO11 + OpenVINO (for multi-object scenes)
Fallback:        OpenCV material analysis (when CLIP unavailable)

Pipeline:
  Image -> YOLO bounding box / segmentation detection (finds WHERE objects are)
        -> CLIP waste classification (identifies WHAT material it is)
        -> Known-object mass lookup (direct mass from database)
        -> Energy + Environmental calculation

Solves the COCO misclassification problem:
  OLD: YOLO/COCO detects 'bottle' as 'remote' -> maps to 'ewaste'
  NEW: CLIP directly understands 'a photo of a plastic bottle' -> 'plastic'
"""
import logging
import math
import random
from collections import Counter
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.services.material_classifier import classify_material
from app.config import (
    CONFIDENCE_THRESHOLD, IMAGE_SIZE, IOU_THRESHOLD,
    PIXELS_PER_CM,
    YOLO_MODEL_PATH, YOLO_OV_INT8_DIR, YOLO_OV_FP_DIR,
)

logger = logging.getLogger(__name__)

# ── COCO → Waste Category Mapping (all 80 COCO classes) ────────────
COCO_TO_WASTE: dict[str, str] = {
    "bottle": "plastic", "cup": "plastic", "wine glass": "glass",
    "fork": "metal", "knife": "metal", "spoon": "metal",
    "bowl": "plastic", "vase": "glass",
    "book": "paper", "clock": "ewaste", "scissors": "metal",
    "banana": "organic", "apple": "organic", "sandwich": "organic",
    "orange": "organic", "broccoli": "organic", "carrot": "organic",
    "hot dog": "organic", "pizza": "organic", "donut": "organic", "cake": "organic",
    "tv": "ewaste", "laptop": "ewaste", "mouse": "ewaste",
    "remote": "ewaste", "keyboard": "ewaste", "cell phone": "ewaste",
    "microwave": "ewaste", "oven": "ewaste", "toaster": "ewaste",
    "refrigerator": "ewaste", "hair drier": "ewaste",
    "backpack": "textile", "umbrella": "textile", "handbag": "textile",
    "tie": "textile", "suitcase": "textile",
    "chair": "wood", "couch": "wood", "bed": "wood", "dining table": "wood",
    "potted plant": "organic",
    "bicycle": "metal", "car": "metal", "motorcycle": "metal",
    "airplane": "metal", "bus": "metal", "train": "metal",
    "truck": "metal", "boat": "metal",
    "frisbee": "plastic", "skis": "composite", "snowboard": "composite",
    "sports ball": "rubber", "kite": "plastic", "baseball bat": "wood",
    "baseball glove": "textile", "skateboard": "wood", "surfboard": "plastic",
    "tennis racket": "composite",
    "toilet": "ceramic", "sink": "ceramic",
    "toothbrush": "plastic",
    "person": "_ignore", "cat": "_ignore", "dog": "_ignore",
    "horse": "_ignore", "sheep": "_ignore", "cow": "_ignore",
    "elephant": "_ignore", "bear": "_ignore", "zebra": "_ignore",
    "giraffe": "_ignore", "bird": "_ignore",
    "traffic light": "ewaste", "fire hydrant": "metal",
    "stop sign": "metal", "parking meter": "metal", "bench": "wood",
}

# ── CLIP Waste Classification Prompts ───────────────────────
CLIP_WASTE_LABELS: list[tuple[str, str, str | None, str | None]] = [
    # ── PLASTIC ──
    ("a photo of a plastic water bottle", "plastic", "pet", "plastic:pet_bottle_500ml"),
    ("a photo of a large plastic bottle", "plastic", "pet", "plastic:pet_bottle_1l"),
    ("a photo of a crushed plastic bottle", "plastic", "pet", "plastic:pet_bottle_500ml"),
    ("a photo of a plastic bag", "plastic", "ldpe", "plastic:plastic_bag"),
    ("a photo of plastic food packaging", "plastic", "ldpe", "plastic:plastic_wrapper"),
    ("a photo of a disposable plastic cup", "plastic", "ps", "plastic:plastic_cup"),
    ("a photo of a styrofoam food container", "plastic", "ps", "plastic:styrofoam_container"),
    ("a photo of a plastic straw", "plastic", None, "plastic:plastic_straw"),
    ("a photo of plastic waste", "plastic", None, None),
    ("a photo of a plastic container", "plastic", "hdpe", None),
    # ── PAPER ──
    ("a photo of a cardboard box", "paper", "cardboard", "paper:cardboard_box_small"),
    ("a photo of cardboard packaging", "paper", "cardboard", "paper:cardboard_box_medium"),
    ("a photo of a newspaper", "paper", "newspaper", "paper:newspaper"),
    ("a photo of a paper coffee cup", "paper", None, "paper:paper_cup"),
    ("a photo of paper waste", "paper", None, None),
    ("a photo of tissue paper", "paper", None, "paper:tissue_paper"),
    ("a photo of a paper plate", "paper", None, "paper:paper_plate"),
    # ── METAL ──
    ("a photo of an aluminum soda can", "metal", "aluminium", "metal:aluminium_can"),
    ("a photo of a crushed aluminum can", "metal", "aluminium", "metal:aluminium_can"),
    ("a photo of a tin food can", "metal", "steel", "metal:steel_can"),
    ("a photo of aluminum foil", "metal", "aluminium", "metal:aluminium_foil"),
    ("a photo of metal scrap", "metal", None, None),
    ("a photo of metal waste", "metal", None, None),
    # ── GLASS ──
    ("a photo of a glass bottle", "glass", "clear_glass", "glass:glass_bottle_330ml"),
    ("a photo of a wine bottle", "glass", "colored_glass", "glass:glass_bottle_750ml"),
    ("a photo of a glass jar", "glass", "clear_glass", "glass:glass_jar"),
    ("a photo of broken glass pieces", "glass", None, "glass:broken_glass"),
    ("a photo of glass waste", "glass", None, None),
    # ── ORGANIC ──
    ("a photo of food waste and scraps", "organic", "organic_food", "organic:food_scraps_small"),
    ("a photo of a banana peel", "organic", "organic_food", "organic:banana_peel"),
    ("a photo of fruit peels", "organic", "organic_food", None),
    ("a photo of vegetable scraps", "organic", "organic_food", "organic:food_scraps_small"),
    ("a photo of compost material", "organic", "organic_garden", None),
    ("a photo of organic waste", "organic", None, None),
    ("a photo of garden leaves and yard waste", "organic", "organic_garden", "organic:leaf_pile_small"),
    ("a photo of a coconut shell", "organic", "organic_food", "organic:coconut_shell"),
    # ── E-WASTE ──
    ("a photo of an old mobile phone", "ewaste", "phones_tablets", "ewaste:phone_old"),
    ("a photo of electronic waste and circuit boards", "ewaste", None, "ewaste:circuit_board_small"),
    ("a photo of a computer keyboard", "ewaste", "peripherals", "ewaste:keyboard"),
    ("a photo of cables and wires", "ewaste", "cables_wires", "ewaste:charger_cable"),
    ("a photo of a computer mouse", "ewaste", "peripherals", "ewaste:mouse"),
    ("a photo of batteries", "ewaste", "batteries", "ewaste:battery_aa"),
    ("a photo of a broken laptop computer", "ewaste", "laptops_desktops", None),
    # ── TEXTILE ──
    ("a photo of old clothes", "textile", "cotton", "textile:tshirt"),
    ("a photo of textile waste and fabric scraps", "textile", None, None),
    ("a photo of a worn out t-shirt", "textile", "cotton", "textile:tshirt"),
    ("a photo of old shoes", "textile", None, None),
    ("a photo of a towel", "textile", "cotton", "textile:towel"),
    # ── WOOD ──
    ("a photo of wood scraps and planks", "wood", "untreated", "wood:plank_small"),
    ("a photo of wooden chopsticks", "wood", None, "wood:chopsticks"),
    ("a photo of tree branches and twigs", "wood", None, None),
    ("a photo of a popsicle stick", "wood", None, "wood:popsicle_stick"),
    # ── RUBBER ──
    ("a photo of a rubber tire", "rubber", "natural", "rubber:tire_car"),
    ("a photo of rubber waste", "rubber", None, None),
    ("a photo of rubber shoe soles", "rubber", None, "rubber:shoe_sole"),
    # ── MEDICAL ──
    ("a photo of medical waste", "medical", None, None),
    ("a photo of a disposable syringe", "medical", "sharps", "medical:syringe"),
    ("a photo of a disposable face mask", "medical", None, "medical:face_mask"),
    ("a photo of medical surgical gloves", "medical", None, "medical:gloves_pair"),
    # ── GENERAL ──
    ("a photo of mixed waste and garbage", "general_waste", None, None),
    ("a photo of trash on the ground", "general_waste", None, None),
    ("a photo of litter and refuse", "general_waste", None, None),
]

DEFAULT_CLASS_MAP: dict[int, str] = {
    0: "plastic", 1: "paper", 2: "metal", 3: "glass", 4: "organic",
    5: "ewaste", 6: "textile", 7: "wood", 8: "rubber", 9: "medical",
}

CONFUSION_PAIRS: dict[str, list[str]] = {
    "plastic": ["glass", "composite"],
    "paper":   ["textile", "plastic"],
    "metal":   ["glass", "ewaste"],
    "glass":   ["plastic", "metal"],
    "organic": ["general_waste", "wood"],
    "medical": ["plastic", "chemical"],
    "ewaste":  ["metal", "plastic"],
}

AVG_MASS_PER_ITEM: dict[str, float] = {
    "plastic": 0.035, "paper": 0.015, "metal": 0.080, "glass": 0.250,
    "organic": 0.150, "ewaste": 0.500, "textile": 0.200, "wood": 0.400,
    "rubber": 0.100, "medical": 0.050, "composite": 0.080, "ceramic": 0.300,
    "general_waste": 0.050,
}


def _confidence_tier(conf: float) -> dict:
    if conf >= 0.85:
        return {"level": "high", "color": "green", "warning": None}
    elif conf >= 0.60:
        return {"level": "medium", "color": "yellow",
                "warning": "Medium confidence — verify waste type and consider selecting sub-type manually."}
    elif conf >= 0.40:
        return {"level": "low", "color": "orange",
                "warning": "Low confidence — AI detection may be inaccurate. Please manually verify or override waste type."}
    else:
        return {"level": "very_low", "color": "red",
                "warning": "Very low confidence — detection is unreliable. Manual waste type selection strongly recommended."}


def _calculate_iou(box1: list[float], box2: list[float]) -> float:
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    a1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    a2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = a1 + a2 - inter
    return inter / union if union > 0 else 0.0


def _apply_nms(detections: list[dict], iou_threshold: float) -> list[dict]:
    """NMS on a list of dicts with 'bbox'/'box' and 'confidence' keys."""
    if not detections:
        return []
    detections = sorted(detections, key=lambda x: x["confidence"], reverse=True)
    kept = []
    while detections:
        best = detections.pop(0)
        kept.append(best)
        best_box = best.get("bbox") or best.get("box", [0, 0, 0, 0])
        detections = [d for d in detections
                      if _calculate_iou(best_box, d.get("bbox") or d.get("box", [0, 0, 0, 0])) < iou_threshold]
    return kept


def _nms_merge(boxes: list, scores: list, labels: list,
               iou_thresh: float = 0.30) -> list[int]:
    """Cross-tile NMS that returns kept indices. Works across all label types."""
    if not boxes:
        return []
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    kept: list[int] = []
    while order:
        best = order.pop(0)
        kept.append(best)
        order = [i for i in order
                 if _calculate_iou(boxes[best], boxes[i]) < iou_thresh]
    return kept


def _containment(box1: list, box2: list) -> float:
    """Fraction of box2's area that is inside box1."""
    ix1 = max(box1[0], box2[0])
    iy1 = max(box1[1], box2[1])
    ix2 = min(box1[2], box2[2])
    iy2 = min(box1[3], box2[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    a2 = max(1.0, (box2[2] - box2[0]) * (box2[3] - box2[1]))
    return inter / a2


def _smart_dedup(detections: list[dict],
                 iou_thresh: float = 0.30,
                 containment_thresh: float = 0.40) -> list[dict]:
    """
    Two-pass deduplication (proximity-merge removed — it wrongly joins
    separate objects in dense pile scenes):
      1. Standard IoU NMS          — catches clean overlapping boxes
      2. Containment suppression   — catches tile-edge fragments where one
                                     box is mostly inside a larger box
    """
    if len(detections) <= 1:
        return detections

    # Pass 1 — standard IoU NMS
    dets = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    kept: list[dict] = []
    while dets:
        best = dets.pop(0)
        kept.append(best)
        dets = [d for d in dets
                if _calculate_iou(best["bbox"], d["bbox"]) < iou_thresh]

    # Pass 2 — containment suppression
    # Suppresses a box if 40 %+ of its area is already covered by a
    # higher-confidence box that was kept earlier in Pass 1.
    result: list[dict] = []
    for det in kept:
        dominated = any(
            _containment(other["bbox"], det["bbox"]) >= containment_thresh
            for other in result
        )
        if not dominated:
            result.append(det)

    return result


class WasteClassifier:
    """CLIP zero-shot + YOLO segmentation hybrid waste classifier."""

    def __init__(self):
        self.model: Any = None
        self.mode: str = "dummy"
        self.clip_model: Any = None
        self.clip_preprocess: Any = None
        self.clip_tokenizer: Any = None
        self.clip_text_features: Any = None
        self.clip_mode: str = "none"
        self.class_map: dict[int, str] = dict(DEFAULT_CLASS_MAP)
        self.coco_names: dict[int, str] = {}
        self._load_clip()
        self._load_model()

    # ── CLIP ────────────────────────────────────────────────
    def _load_clip(self):
        try:
            import open_clip
            logger.info("Loading CLIP ViT-B-32...")
            model, _, preprocess = open_clip.create_model_and_transforms(
                'ViT-B-32', pretrained='openai'
            )
            tokenizer = open_clip.get_tokenizer('ViT-B-32')
            model.eval()
            self.clip_model = model
            self.clip_preprocess = preprocess
            self.clip_tokenizer = tokenizer
            self.clip_mode = "open_clip"
            self._precompute_clip_embeddings()
            logger.info("CLIP loaded — %d waste prompts ready", len(CLIP_WASTE_LABELS))
        except ImportError:
            logger.warning("open-clip-torch not installed — using fallback classifier")
            self.clip_mode = "none"
        except Exception as exc:
            logger.warning("CLIP load failed: %s — using fallback", exc)
            self.clip_mode = "none"

    def _precompute_clip_embeddings(self):
        import torch
        texts = [label[0] for label in CLIP_WASTE_LABELS]
        tokens = self.clip_tokenizer(texts)
        with torch.no_grad():
            features = self.clip_model.encode_text(tokens)
            features = features / features.norm(dim=-1, keepdim=True)
        self.clip_text_features = features

    def _clip_classify(self, crop_bgr: np.ndarray) -> dict | None:
        if self.clip_mode == "none" or crop_bgr is None or crop_bgr.size == 0:
            return None
        import torch
        from PIL import Image
        try:
            rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
            img_tensor = self.clip_preprocess(pil_img).unsqueeze(0)
            with torch.no_grad():
                img_features = self.clip_model.encode_image(img_tensor)
                img_features = img_features / img_features.norm(dim=-1, keepdim=True)
            sims = (img_features @ self.clip_text_features.T).squeeze(0)

            cat_sums: dict[str, float] = {}
            cat_counts: dict[str, int] = {}
            cat_best_idx: dict[str, int] = {}
            cat_best_sim: dict[str, float] = {}
            for i, (_, wtype, _, _) in enumerate(CLIP_WASTE_LABELS):
                s = sims[i].item()
                cat_sums[wtype] = cat_sums.get(wtype, 0.0) + s
                cat_counts[wtype] = cat_counts.get(wtype, 0) + 1
                if wtype not in cat_best_sim or s > cat_best_sim[wtype]:
                    cat_best_sim[wtype] = s
                    cat_best_idx[wtype] = i

            cat_avg = {c: cat_sums[c] / cat_counts[c] for c in cat_sums}
            cats = list(cat_avg.keys())
            sims_t = torch.tensor([cat_avg[c] for c in cats])
            probs = torch.nn.functional.softmax(sims_t * 100, dim=0)
            cat_probs = {cats[i]: round(probs[i].item(), 4) for i in range(len(cats))}

            best_idx = probs.argmax().item()
            best_cat = cats[best_idx]
            best_conf = probs[best_idx].item()

            # Medical / chemical are easily confused with plastic bags, gloves, etc.
            # Require strong evidence before labelling anything as medical/chemical.
            # If confidence is below the floor, fall back to the best non-hazardous cat.
            _HIGH_RISK_FLOOR = {"medical": 0.65, "chemical": 0.72}
            if best_cat in _HIGH_RISK_FLOOR and best_conf < _HIGH_RISK_FLOOR[best_cat]:
                safe_cats = {c: p for c, p in cat_probs.items()
                             if c not in _HIGH_RISK_FLOOR}
                if safe_cats:
                    best_cat = max(safe_cats, key=safe_cats.get)
                    best_conf = safe_cats[best_cat]

            bi = cat_best_idx[best_cat]
            _, _, subtype, known_key = CLIP_WASTE_LABELS[bi]
            return {
                "waste_type": best_cat,
                "subtype_hint": subtype,
                "known_object_key": known_key,
                "confidence": round(min(best_conf, 0.99), 4),
                "matched_prompt": CLIP_WASTE_LABELS[bi][0],
                "category_scores": cat_probs,
            }
        except Exception as exc:
            logger.warning("CLIP classification failed: %s", exc)
            return None

    # ── YOLO ─────────────────────────────────────────────────
    def _load_model(self):
        from ultralytics import YOLO

        for label, path, mode in [
            ("INT8", YOLO_OV_INT8_DIR, "openvino_int8"),
            ("FP16", YOLO_OV_FP_DIR, "openvino"),
            ("PT", Path(YOLO_MODEL_PATH), "yolo"),
        ]:
            p = path if hasattr(path, 'exists') else Path(path)
            if not p.exists():
                continue
            try:
                # Use task="segment" so masks are produced when available
                self.model = YOLO(str(path), task="segment")
                self.mode = mode
                self._sync_class_map()
                logger.info("YOLO %s loaded from %s", label, path)
                return
            except Exception as exc:
                logger.warning("YOLO %s load failed: %s", label, exc)

        logger.warning("No YOLO model — using dummy/CLIP-only mode")
        self.mode = "dummy"

    def _sync_class_map(self):
        try:
            names = None
            if hasattr(self.model, "model") and hasattr(self.model.model, "names"):
                names = self.model.model.names
            elif hasattr(self.model, "names"):
                names = self.model.names
            if names and isinstance(names, dict):
                self.coco_names = dict(names)
                for idx, name in names.items():
                    low = name.lower().strip()
                    self.class_map[idx] = COCO_TO_WASTE.get(low, "general_waste")
        except Exception as exc:
            logger.debug("Could not sync class map: %s", exc)

    # ── Detection helpers ─────────────────────────────────────
    def _bbox_mask(self, bbox: list) -> np.ndarray:
        """Create a rectangular polygon mask from a bounding box."""
        x1, y1, x2, y2 = bbox
        return np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)

    def _yolo_detect(self, image_path: str) -> list[dict]:
        """Standard (single-pass) YOLO detection with optional segmentation masks."""
        results = self.model.predict(
            source=image_path,
            imgsz=IMAGE_SIZE,
            conf=CONFIDENCE_THRESHOLD,
            iou=IOU_THRESHOLD,
            verbose=False,
        )
        detections: list[dict] = []
        for r in results:
            if r.boxes is None:
                continue
            has_masks = r.masks is not None and len(r.masks.xy) == len(r.boxes)
            for i, box in enumerate(r.boxes):
                cls_id = int(box.cls[0])
                waste_type = self.class_map.get(cls_id, "general_waste")
                if waste_type == "_ignore":
                    continue
                conf = round(float(box.conf[0]), 4)
                coco_name = self.coco_names.get(cls_id, "unknown")
                bbox = [round(c, 1) for c in box.xyxy[0].tolist()]
                mask = r.masks.xy[i] if has_masks else self._bbox_mask(bbox)
                det = {
                    "waste_type": waste_type,
                    "coco_class": coco_name,
                    "confidence": conf,
                    "bbox": bbox,
                    "box": bbox,
                    "mask": mask,
                }
                detections.append(det)
        return detections

    def _tiled_detect(self, image_path: str, img: np.ndarray) -> list[dict]:
        """Overlapping-tile YOLO detection for large / high-res images."""
        h, w = img.shape[:2]
        tile_size = IMAGE_SIZE        # 640
        overlap   = (tile_size * 3) // 4  # 480 px — 75 % overlap so any object
        step      = tile_size - overlap   # 160 px   appears whole in ≥1 tile

        all_boxes:  list[list[float]] = []
        all_scores: list[float]       = []
        all_labels: list[str]         = []
        all_coco:   list[str]         = []
        all_masks:  list[np.ndarray]  = []

        tiles = []
        for y0 in range(0, h, step):
            for x0 in range(0, w, step):
                y1 = min(y0 + tile_size, h)
                x1 = min(x0 + tile_size, w)
                if (x1 - x0) < tile_size // 3 or (y1 - y0) < tile_size // 3:
                    continue
                tiles.append((x0, y0, x1, y1))

        logger.info("Tiling: %dx%d → %d tiles (%dpx, %dpx overlap)",
                    w, h, len(tiles), tile_size, overlap)

        for tx0, ty0, tx1, ty1 in tiles:
            crop = img[ty0:ty1, tx0:tx1]
            pad_h = tile_size - crop.shape[0]
            pad_w = tile_size - crop.shape[1]
            if pad_h > 0 or pad_w > 0:
                crop = cv2.copyMakeBorder(crop, 0, pad_h, 0, pad_w,
                                          cv2.BORDER_CONSTANT, value=(114, 114, 114))

            results = self.model.predict(
                source=crop,
                imgsz=tile_size,
                conf=max(0.08, CONFIDENCE_THRESHOLD - 0.17),
                iou=IOU_THRESHOLD,
                verbose=False,
            )

            for r in results:
                if r.boxes is None:
                    continue
                has_masks = r.masks is not None and len(r.masks.xy) == len(r.boxes)
                for i, box in enumerate(r.boxes):
                    cls_id = int(box.cls[0])
                    waste_type = self.class_map.get(cls_id, "general_waste")
                    if waste_type == "_ignore":
                        continue
                    conf = float(box.conf[0])
                    bx1, by1, bx2, by2 = box.xyxy[0].tolist()

                    # Translate tile-local → full-image coordinates
                    bx1 += tx0; by1 += ty0; bx2 += tx0; by2 += ty0
                    bx1, by1 = max(0.0, bx1), max(0.0, by1)
                    bx2, by2 = min(float(w), bx2), min(float(h), by2)
                    bbox = [bx1, by1, bx2, by2]

                    if has_masks:
                        pts = r.masks.xy[i].copy().astype(np.float32)
                        pts[:, 0] += tx0
                        pts[:, 1] += ty0
                        pts[:, 0] = np.clip(pts[:, 0], 0, w)
                        pts[:, 1] = np.clip(pts[:, 1], 0, h)
                        mask = pts
                    else:
                        mask = self._bbox_mask(bbox)

                    all_boxes.append(bbox)
                    all_scores.append(conf)
                    all_labels.append(waste_type)
                    all_coco.append(self.coco_names.get(cls_id, "unknown"))
                    all_masks.append(mask)

        keep = _nms_merge(all_boxes, all_scores, all_labels, iou_thresh=0.30)
        detections: list[dict] = []
        for i in keep:
            det = {
                "waste_type": all_labels[i],
                "coco_class": all_coco[i],
                "confidence": round(all_scores[i], 4),
                "bbox": [round(c, 1) for c in all_boxes[i]],
                "box":  [round(c, 1) for c in all_boxes[i]],
                "mask": all_masks[i],
            }
            detections.append(det)
        return detections

    def _patch_classify(self, img: np.ndarray, patch_size: int = 320) -> dict:
        """
        Classify dense / pile waste by CLIP-sampling overlapping patches.
        Returns: {is_pile, composition, patch_results, patch_count}
        """
        if self.clip_mode == "none":
            return {"is_pile": False}

        h, w = img.shape[:2]
        step = patch_size // 2  # 50 % overlap

        patch_results: list[dict] = []
        type_counts: dict[str, int] = {}

        for y0 in range(0, h, step):
            for x0 in range(0, w, step):
                y1 = min(y0 + patch_size, h)
                x1 = min(x0 + patch_size, w)
                if (x1 - x0) < patch_size // 3 or (y1 - y0) < patch_size // 3:
                    continue
                patch = img[y0:y1, x0:x1]
                result = self._clip_classify(patch)
                if result is None:
                    continue
                wtype = result["waste_type"]
                conf  = result["confidence"]
                patch_results.append({
                    "x": x0, "y": y0, "x1": x1, "y1": y1,
                    "waste_type": wtype,
                    "conf": conf,
                    "scores": result.get("category_scores", {}),
                })
                type_counts[wtype] = type_counts.get(wtype, 0) + 1

        if not patch_results:
            return {"is_pile": False}

        total = len(patch_results)
        composition = {wt: round(cnt / total, 4) for wt, cnt in type_counts.items()}
        dominant_frac = max(composition.values())
        is_pile = len(type_counts) >= 2 or dominant_frac < 0.70 or total >= 4

        return {
            "is_pile": is_pile,
            "composition": composition,
            "patch_results": patch_results,
            "patch_count": total,
        }

    def _supplement_with_clip_grid(self, img: np.ndarray,
                                    existing: list[dict],
                                    h: int, w: int,
                                    grid: int = 8,
                                    coverage_thresh: float = 0.02,
                                    clip_conf_thresh: float = 0.12) -> list[dict]:
        """
        Split image into grid x grid cells. For each cell whose centroid is NOT
        already claimed by a YOLO detection, run CLIP and add as a detection.

        Key design decisions vs old version:
        - Centroid-based ownership: a YOLO box only blocks the ONE cell its
          centroid falls in — not every cell it spatially overlaps. This was the
          bug causing large right-half YOLO boxes to bleed 10 %+ into left-half
          cells and silently skip them.
        - coverage_thresh 0.10 → 0.02: even if a large box bleeds slightly into
          a cell, we still run CLIP on it unless 98 %+ is already covered.
        - clip_conf_thresh 0.35 → 0.20: pile-cell CLIP scores are often in the
          0.20–0.35 range; the old threshold dropped them all.
        - No general_waste filter: pile waste commonly scores as general_waste
          and deserves to be detected, not silently discarded.
        """
        if self.clip_mode == "none":
            return existing

        cell_h = h // grid
        cell_w = w // grid
        if cell_h < 32 or cell_w < 32:
            return existing

        # Mark grid cells that already contain a YOLO detection centroid
        yolo_cells: set[tuple[int, int]] = set()
        for d in existing:
            bbox = d.get("bbox") or d.get("box", [])
            if len(bbox) == 4:
                cx = (bbox[0] + bbox[2]) / 2.0
                cy = (bbox[1] + bbox[3]) / 2.0
                gx = min(int(cx * grid / max(w, 1)), grid - 1)
                gy = min(int(cy * grid / max(h, 1)), grid - 1)
                yolo_cells.add((gx, gy))

        new_dets: list[dict] = []
        for gy in range(grid):
            for gx in range(grid):
                # Skip cells already owned by a YOLO centroid
                if (gx, gy) in yolo_cells:
                    continue

                cy0 = gy * cell_h
                cy1 = min((gy + 1) * cell_h, h)
                cx0 = gx * cell_w
                cx1 = min((gx + 1) * cell_w, w)
                cell_bbox = [float(cx0), float(cy0), float(cx1), float(cy1)]
                cell_area = max(1, (cx1 - cx0) * (cy1 - cy0))

                # Secondary: skip if a large YOLO box dominates this cell
                covered = sum(
                    max(0.0, min(d["bbox"][2], cx1) - max(d["bbox"][0], cx0)) *
                    max(0.0, min(d["bbox"][3], cy1) - max(d["bbox"][1], cy0))
                    for d in existing
                    if d.get("bbox") and len(d["bbox"]) == 4
                )
                if covered / cell_area >= coverage_thresh:
                    continue

                patch = img[cy0:cy1, cx0:cx1]
                clip_res = self._clip_classify(patch)
                if clip_res is None or clip_res["confidence"] < clip_conf_thresh:
                    continue

                det: dict = {
                    "waste_type": clip_res["waste_type"],
                    "coco_class": "clip_grid",
                    # Slightly discount CLIP-grid confidence vs YOLO
                    "confidence": round(clip_res["confidence"] * 0.80, 4),
                    "bbox": cell_bbox,
                    "box":  cell_bbox,
                    "mask": self._bbox_mask(cell_bbox),
                    "subtype_hint":     clip_res.get("subtype_hint"),
                    "known_object_key": clip_res.get("known_object_key"),
                    "classification_method": "clip_grid",
                    "clip_scores": clip_res.get("category_scores", {}),
                }
                det.update(self._enrich_detection(det))
                new_dets.append(det)

        if not new_dets:
            return existing

        # Dedup CLIP cells among themselves (IoU only — no containment so cells
        # that share partial area with a YOLO box are NOT suppressed; we want
        # the extra coverage even if it overlaps a large YOLO detection).
        new_dets = _apply_nms(new_dets, iou_threshold=0.40)
        combined = existing + new_dets
        logger.info("CLIP grid: +%d cells (total %d → %d)",
                    len(new_dets), len(existing), len(combined))
        return combined

    # ── Main public entry point ────────────────────────────────
    def detect(self, image_path: str, force_tile: bool = False) -> list[dict]:
        """
        Multi-stage waste detection pipeline:
          1a. Full-image YOLO  — reliable for isolated / large objects
          1b. Tiled YOLO       — catches small objects and dense piles
          1c. Merge both passes with aggressive IoU+containment dedup
          2.  CLIP grid scan   — fills uncovered image regions (always runs)
          3.  Pile fallback    — patch-CLIP for scenes YOLO+grid still misses
          4.  Full-image last resort
          5.  CLIP + material re-classify each detection
          6.  Final smart dedup
        """
        try:
            img = cv2.imread(image_path)
            if img is None:
                logger.error("Failed to read image: %s", image_path)
                return self._dummy_detect(image_path)
        except Exception as e:
            logger.error("Error reading image %s: %s", image_path, e)
            return []

        if self.mode == "dummy":
            return self._dummy_detect(image_path)

        h, w = img.shape[:2]

        # ── Step 1a: Full-image YOLO ─────────────────────────────
        # One clean pass at full resolution — the most reliable for isolated
        # objects and avoids the tile-stitching duplicates that plague
        # single-object scenes.
        try:
            full_dets = self._yolo_detect(image_path)
        except Exception as exc:
            logger.error("Full-image YOLO failed: %s", exc)
            full_dets = []

        # ── Step 1b: Tiled YOLO ──────────────────────────────────
        # 75 % overlap tiling gives dense-pile coverage but produces many
        # duplicate boxes for simple scenes; the merge step below handles that.
        try:
            use_tiling = force_tile or max(h, w) > 480
            tiled_dets = self._tiled_detect(image_path, img) if use_tiling else []
        except Exception as exc:
            logger.error("Tiled YOLO failed: %s", exc)
            tiled_dets = []

        # ── Step 1c: Merge passes with aggressive dedup ──────────
        # IoU 0.50 (was 0.30) — catches the "same bottle in 2 tiles" case where
        # boxes differ slightly in coordinates (IoU ~0.6–0.9) but would have
        # survived the more lenient 0.30 threshold.
        # Containment 0.25 (was 0.40) — suppresses partial-bottle sub-detections
        # (cap, label) that appear fully inside the main bottle box.
        all_yolo = full_dets + tiled_dets
        if len(all_yolo) > 1:
            # IoU 0.50: aggressively merges same-object duplicates from two passes
            # containment 0.55: only suppresses boxes that are mostly inside a
            #   bigger one (cap/label detections inside a full bottle box)
            yolo_dets = _smart_dedup(all_yolo, iou_thresh=0.50, containment_thresh=0.55)
            logger.info("Dual YOLO: %d full + %d tiled → %d merged",
                        len(full_dets), len(tiled_dets), len(yolo_dets))
        else:
            yolo_dets = all_yolo

        # ── Step 2: CLIP grid scan ───────────────────────────────
        # Always runs — even when yolo_dets=[] — so pile left-halves that YOLO
        # completely misses still get coverage.
        if self.clip_mode != "none":
            yolo_dets = self._supplement_with_clip_grid(img, yolo_dets, h, w)

        # ── Step 3: Pile / total-YOLO-fail fallback ─────────────
        img_area = float(h * w)
        detected_coverage = sum(
            max(0.0, d["bbox"][2] - d["bbox"][0]) * max(0.0, d["bbox"][3] - d["bbox"][1])
            for d in yolo_dets
        )
        coverage_ratio = detected_coverage / img_area if img_area > 0 else 1.0

        is_yolo_fail = (
            not yolo_dets
            or (len(yolo_dets) == 1 and yolo_dets[0].get("confidence", 0) < 0.40)
            or (len(yolo_dets) < 4 and coverage_ratio < 0.20)
        )

        if is_yolo_fail and self.clip_mode != "none":
            pile_info = self._patch_classify(img)
            if pile_info.get("is_pile") and pile_info.get("composition"):
                comp = pile_info["composition"]
                original_yolo = list(yolo_dets)
                patch_dets: list[dict] = []

                for pr in pile_info.get("patch_results", []):
                    px0, py0 = int(pr["x"]), int(pr["y"])
                    px1, py1 = int(pr["x1"]), int(pr["y1"])
                    frac = comp.get(pr["waste_type"], 0.05)
                    bbox = [float(px0), float(py0), float(px1), float(py1)]
                    det: dict = {
                        "waste_type": pr["waste_type"],
                        "coco_class": "pile_patch",
                        "confidence": round(min(pr["conf"], 0.90), 4),
                        "bbox": bbox,
                        "box":  bbox,
                        "mask": self._bbox_mask(bbox),
                        "subtype_hint": None,
                        "known_object_key": None,
                        "classification_method": "clip_patch",
                        "clip_scores": pr.get("scores", {}),
                        "pile_fraction": frac,
                    }
                    det.update(self._enrich_detection(det))
                    patch_dets.append(det)

                if patch_dets:
                    combined = original_yolo + patch_dets
                    boxes  = [d["bbox"] for d in combined]
                    scores = [d["confidence"] for d in combined]
                    labels = [d["waste_type"] for d in combined]
                    keep   = _nms_merge(boxes, scores, labels, iou_thresh=0.40)
                    yolo_dets = [combined[i] for i in keep]
                    yolo_dets.sort(key=lambda d: d["confidence"], reverse=True)
                    logger.info("Pile detections: %d (YOLO=%d + patches=%d)",
                                len(yolo_dets), len(original_yolo), len(patch_dets))
                    return yolo_dets

                # Fallback: one detection per dominant material type covering full image
                yolo_dets = []
                for wtype, frac in sorted(comp.items(), key=lambda x: -x[1]):
                    if frac < 0.05:
                        continue
                    bbox = [0.0, 0.0, float(w), float(h)]
                    det = {
                        "waste_type": wtype,
                        "coco_class": "pile_patch",
                        "confidence": round(min(frac + 0.30, 0.95), 4),
                        "bbox": bbox,
                        "box":  bbox,
                        "mask": self._bbox_mask(bbox),
                        "subtype_hint": None,
                        "known_object_key": None,
                        "classification_method": "clip_patch",
                        "clip_scores": comp,
                        "pile_fraction": frac,
                    }
                    det.update(self._enrich_detection(det))
                    yolo_dets.append(det)

                if yolo_dets:
                    logger.info("Dense pile: %d material types via patch CLIP", len(yolo_dets))
                    return yolo_dets

        # ── Step 4: Full-image single-object last resort ─────────
        if not yolo_dets:
            logger.warning("No detections — treating full image as single object")
            bbox = [0.0, 0.0, float(w), float(h)]
            yolo_dets = [{
                "waste_type": "general_waste",
                "coco_class": "full_image",
                "confidence": 0.15,
                "bbox": bbox,
                "box":  bbox,
                "mask": self._bbox_mask(bbox),
            }]

        # ── Step 5: CLIP + material re-classification per object ──
        for det in yolo_dets:
            # Ensure both key aliases are populated
            if "bbox" not in det:
                det["bbox"] = det.get("box", [0, 0, w, h])
            if "box" not in det:
                det["box"] = det["bbox"]
            if det.get("mask") is None:
                det["mask"] = self._bbox_mask(det["bbox"])

            bbox = det["bbox"]
            x1, y1, x2, y2 = [int(c) for c in bbox]
            pad_x = max(int((x2 - x1) * 0.10), 5)
            pad_y = max(int((y2 - y1) * 0.10), 5)
            cx1 = max(0,  x1 - pad_x)
            cy1 = max(0,  y1 - pad_y)
            cx2 = min(w, x2 + pad_x)
            cy2 = min(h, y2 + pad_y)
            crop = img[cy1:cy2, cx1:cx2]

            classified = False

            # Primary: CLIP zero-shot
            if self.clip_mode != "none" and crop.size > 0:
                clip_result = self._clip_classify(crop)
                if clip_result and clip_result["confidence"] > 0.15:
                    det["waste_type"]        = clip_result["waste_type"]
                    det["subtype_hint"]      = clip_result.get("subtype_hint")
                    det["known_object_key"]  = clip_result.get("known_object_key")
                    det["confidence"]        = clip_result["confidence"]
                    det["classification_method"] = "clip"
                    det["clip_scores"]       = clip_result.get("category_scores", {})
                    classified = True

            # Fallback: material classifier (OpenCV visual analysis)
            if not classified and crop.size > 0:
                mat_result = classify_material(crop, det.get("coco_class", ""))
                if mat_result and mat_result.get("material_confidence", 0) > 0.20:
                    det["waste_type"]   = mat_result["waste_type"]
                    det["confidence"]   = round(mat_result["material_confidence"], 4)
                    det["classification_method"] = "material_visual"
                    det["subtype_hint"]     = None
                    det["known_object_key"] = None
                    classified = True

            if not classified:
                det["classification_method"] = "coco_mapping"
                det.setdefault("subtype_hint", None)
                det.setdefault("known_object_key", None)

            det.update(self._enrich_detection(det))

        # ── Step 6: Final smart dedup ─────────────────────────────
        # Catch remaining true duplicates (same object, two very similar boxes).
        # containment_thresh=0.60: only suppress a box when 60 %+ of it sits
        # inside a higher-conf box — this keeps CLIP grid cells that share
        # moderate area with a YOLO box but genuinely cover additional objects.
        if len(yolo_dets) > 1:
            yolo_dets = _smart_dedup(yolo_dets, iou_thresh=0.45, containment_thresh=0.60)
            for det in yolo_dets:
                det["mask"] = self._bbox_mask(det["bbox"])
                det["box"]  = det["bbox"]

        yolo_dets.sort(key=lambda d: d["confidence"], reverse=True)
        return yolo_dets

    # ── Fallback detectors ─────────────────────────────────────
    def _classify_fallback(self, image_path: str) -> list[dict]:
        try:
            cls_results = self.model.predict(source=image_path, imgsz=IMAGE_SIZE, verbose=False)
            for r in cls_results:
                if hasattr(r, "probs") and r.probs is not None:
                    top1 = int(r.probs.top1)
                    conf = float(r.probs.top1conf)
                    waste_type = self.class_map.get(top1, "plastic")
                    if waste_type == "_ignore":
                        waste_type = "general_waste"
                    img = cv2.imread(image_path)
                    h, w = img.shape[:2] if img is not None else (640, 640)
                    bbox = [0.0, 0.0, float(w), float(h)]
                    det = {
                        "waste_type": waste_type,
                        "coco_class": self.coco_names.get(top1, "unknown"),
                        "confidence": round(conf, 4),
                        "bbox": bbox,
                        "box":  bbox,
                        "mask": self._bbox_mask(bbox),
                    }
                    det.update(self._enrich_detection(det))
                    return [det]
        except Exception:
            pass
        return self._dummy_detect(image_path)

    def _dummy_detect(self, image_path: str) -> list[dict]:
        img = cv2.imread(image_path)
        h, w = img.shape[:2] if img is not None else (640, 640)
        categories = list(DEFAULT_CLASS_MAP.values())
        detections: list[dict] = []
        for _ in range(random.randint(1, 3)):
            x1 = random.randint(0, max(1, w // 2))
            y1 = random.randint(0, max(1, h // 2))
            x2 = random.randint(x1 + 50, min(w, x1 + w // 2))
            y2 = random.randint(y1 + 50, min(h, y1 + h // 2))
            conf  = round(random.uniform(0.55, 0.98), 4)
            wtype = random.choice(categories)
            bbox  = [float(x1), float(y1), float(x2), float(y2)]
            det = {
                "waste_type": wtype,
                "coco_class": "simulated",
                "confidence": conf,
                "bbox": bbox,
                "box":  bbox,
                "mask": self._bbox_mask(bbox),
            }
            det.update(self._enrich_detection(det))
            detections.append(det)
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections

    def _enrich_detection(self, det: dict) -> dict:
        conf  = det.get("confidence", 0)
        wtype = det.get("waste_type", "general_waste")
        tier  = _confidence_tier(conf)
        warnings: list[str] = []
        if tier["warning"]:
            warnings.append(tier["warning"])
        if self.mode == "dummy":
            warnings.append("Running in DEMO mode — detection is simulated, not from AI model.")
        confusions = CONFUSION_PAIRS.get(wtype, [])
        if confusions and conf < 0.80:
            warnings.append(f"This could also be: {', '.join(confusions)}. Consider verifying.")
        if wtype in ("medical", "chemical"):
            warnings.append(
                "⚠️ Hazardous waste cannot be reliably identified by image alone. "
                "Verify labels/markings on the object."
            )
        return {
            "confidence_tier": tier,
            "possible_confusions": confusions,
            "detection_warnings": warnings,
        }

    # ── Annotation ─────────────────────────────────────────────
    def annotate_image(self, image_path: str, detections: list[dict],
                       output_path: str, density_info: dict | None = None) -> None:
        """Draw segmentation masks (or bounding boxes) with labels on an image."""
        try:
            img = cv2.imread(image_path)
            if img is None:
                return
        except Exception:
            return

        overlay = img.copy()
        h, w = img.shape[:2]

        color_map = {
            "green":  (0, 255, 0),
            "yellow": (0, 255, 255),
            "orange": (0, 165, 255),
            "red":    (0, 0, 255),
        }

        for i, det in enumerate(detections):
            waste_type = det.get("waste_type", "unknown")
            conf = det.get("confidence", 0.0)
            label = f"#{i+1} {waste_type.title()} {conf:.0%}"

            color_name = det.get("confidence_tier", {}).get("color", "green")
            color = color_map.get(color_name, (0, 255, 0)) if isinstance(color_name, str) else tuple(color_name)

            mask = det.get("mask")
            bbox = det.get("bbox") or det.get("box")

            if mask is not None and len(mask) >= 3:
                pts = np.array(mask, dtype=np.int32).reshape((-1, 1, 2))
                cv2.polylines(overlay, [pts], isClosed=True, color=color, thickness=2)
                cv2.fillPoly(overlay, [pts], color)
                rx, ry, rw, rh = cv2.boundingRect(pts)
            elif bbox is not None:
                x1, y1, x2, y2 = [int(c) for c in bbox]
                cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)
                # Semi-transparent fill via rectangle on overlay
                cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
                rx, ry, rw, rh = x1, y1, x2 - x1, y2 - y1
            else:
                continue

            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            lx = rx
            ly = ry - 10
            if ly < th + 10:
                ly = ry + rh + th + 10
            cv2.rectangle(overlay, (lx, ly - th - 5), (lx + tw, ly), color, -1)
            cv2.putText(overlay, label, (lx, ly - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

        final_img = cv2.addWeighted(overlay, 0.6, img, 0.4, 0)
        cv2.imwrite(output_path, final_img)
