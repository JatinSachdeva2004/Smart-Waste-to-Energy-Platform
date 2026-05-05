"""Shared utility functions."""
import uuid
from datetime import datetime
from pathlib import Path

from app.config import ALLOWED_EXTENSIONS, UPLOAD_DIR


def generate_filename(original_name: str) -> str:
    """Generate a unique filename preserving the extension."""
    ext = Path(original_name).suffix.lower()
    return f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{ext}"


def validate_image_extension(filename: str) -> bool:
    """Check if the file has an allowed image extension."""
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS


def get_upload_path(filename: str) -> Path:
    """Return the full path for an uploaded file."""
    return UPLOAD_DIR / filename


def format_number(value: float, decimals: int = 2) -> str:
    """Format a number with specified decimal places."""
    if value >= 1_000_000:
        return f"{value / 1_000_000:.{decimals}f}M"
    if value >= 1_000:
        return f"{value / 1_000:.{decimals}f}K"
    return f"{value:.{decimals}f}"
