"""Application configuration and constants."""
import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
REPORT_DIR = BASE_DIR / "reports"
STATIC_DIR = BASE_DIR / "static"
TEMPLATE_DIR = BASE_DIR / "templates"
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"

UPLOAD_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)

# ── Database ───────────────────────────────────────────
# Use the DATABASE_URL from the environment variable if it exists (for production),
# otherwise, fall back to the local SQLite database (for development).
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR / 'waste_energy.db'}")

# ── AI Model ───────────────────────────────────────────
# Priority: INT8 quantized > FP16 OpenVINO > PyTorch .pt
YOLO_MODEL_NAME = "yolov8s-seg"
YOLO_MODEL_PATH = os.environ.get("YOLO_MODEL_PATH", str(MODEL_DIR / f"{YOLO_MODEL_NAME}.pt"))
YOLO_OV_FP_DIR = MODEL_DIR / f"{YOLO_MODEL_NAME}_openvino_model"
YOLO_OV_INT8_DIR = MODEL_DIR / f"{YOLO_MODEL_NAME}_openvino_int8_model"
CONFIDENCE_THRESHOLD = 0.25
IOU_THRESHOLD = 0.30
IMAGE_SIZE = 640

# ── Waste Categories (broad types the AI model detects) ─
WASTE_CATEGORIES = [
    "plastic", "paper", "metal", "glass", "organic",
    "ewaste", "textile", "wood", "rubber", "medical",
    "construction", "ceramic", "composite", "garden", "ash",
]

# ── Upload Limits ──────────────────────────────────────
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# ── Size Estimation ────────────────────────────────────
# Default pixels-per-cm (calibrated for typical phone photos at ~50cm distance)
# 12MP phone (~4032x3024) viewing a 70cm wide scene → ~57 px/cm
PIXELS_PER_CM = 50.0

# ── Depth Estimation (MiDaS) ───────────────────────────
ENABLE_DEPTH_ESTIMATION = True    # Set False to disable MiDaS (saves ~100 MB RAM)
DEPTH_MODEL_TYPE = "midas_small"  # Options: midas_small, dpt_hybrid

# ── Segmentation ───────────────────────────────────────
ENABLE_SEGMENTATION = True        # GrabCut + Watershed mask extraction

# ── Energy / Environmental Constants ──────────────────
KWH_PER_MJ = 1 / 3.6  # 1 kWh = 3.6 MJ
CO2_PER_TREE_PER_YEAR_KG = 22.0
AVG_HOME_DAILY_KWH = 30.0
