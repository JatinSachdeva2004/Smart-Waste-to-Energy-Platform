"""
Upload route — orchestrates the full analysis pipeline:
  Image → AI classify (with tiling) → density estimation → size/mass per object
  → energy calc → environmental → recommendation → DB

Supports:
  - Multi-object detection (processes ALL detected objects)
  - High-resolution tiling for dense/pile images
  - Density estimation + instance counting for large waste piles
  - Manual weight override
  - Reference object calibration (coin/card)
  - Waste-type manual override
  - Real-world energy modifiers (moisture, contamination)
"""
from __future__ import annotations
import json, os, uuid, traceback
import logging
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, Request, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _sanitize(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

from app.config import UPLOAD_DIR, MAX_FILE_SIZE_MB
from app.models.database import get_db
from app.models.waste_record import WasteRecord
from app.services.ai_classifier import WasteClassifier
from app.services.size_estimator import estimate_size_and_mass, get_subtypes_for_category
from app.services.energy_calculator import calculate_energy
from app.services.environmental import calculate_environmental_impact
from app.services.recommendation import generate_recommendation
from app.utils.helpers import validate_image_extension

router = APIRouter()
classifier = WasteClassifier()


@router.post("/upload", response_class=JSONResponse)
async def upload_and_analyze(
    request: Request,
    file: UploadFile = File(...),
    user_subtype: str = Form(None),
    manual_weight_kg: float = Form(None),
    ref_type: str = Form(None),
    user_waste_type: str = Form(None),
    contamination: str = Form("light"),
    moisture_pct: float = Form(None),
    db: Session = Depends(get_db),
):
    try:
        return await _run_analysis(
            file=file,
            user_subtype=user_subtype,
            manual_weight_kg=manual_weight_kg,
            ref_type=ref_type,
            user_waste_type=user_waste_type,
            contamination=contamination,
            moisture_pct=moisture_pct,
            db=db,
        )
    except Exception as exc:
        logger.error("Upload pipeline error: %s\n%s", exc, traceback.format_exc())
        return JSONResponse(
            {"error": f"Analysis failed: {exc}", "detail": traceback.format_exc()},
            status_code=500,
        )


async def _run_analysis(
    file: UploadFile,
    user_subtype,
    manual_weight_kg,
    ref_type,
    user_waste_type,
    contamination,
    moisture_pct,
    db: Session,
) -> JSONResponse:
    # --- 1. Validate ----
    if not validate_image_extension(file.filename or ""):
        return JSONResponse({"error": "Invalid image format. Use jpg/png/webp."}, status_code=400)

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        return JSONResponse({"error": f"File exceeds {MAX_FILE_SIZE_MB} MB limit."}, status_code=400)

    # --- 2. Save upload ----
    ext = os.path.splitext(file.filename or "img.jpg")[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(save_path, "wb") as f:
        f.write(contents)

    session_id = uuid.uuid4().hex[:16]

    # --- 3. AI Classification ----
    detections = classifier.detect(save_path)
    
    # This now returns a fallback detection if YOLO finds nothing.
    if not detections:
        return JSONResponse(
            {"error": "AI analysis failed: Could not identify any objects or materials in the image."},
            status_code=400
        )

    # --- 4. Process EACH detected object ----
    objects_results = []
    record_ids = []
    
    # --- 5. Annotated image ----
    ann_filename = f"ann_{filename}"
    ann_path = os.path.join(UPLOAD_DIR, ann_filename)
    classifier.annotate_image(save_path, detections, ann_path)

    for idx, det in enumerate(detections):
        # Allow user to override waste type (applies to all objects if set)
        waste_type = user_waste_type if user_waste_type else det["waste_type"]
        confidence = det["confidence"]
        box = det.get("box", [0, 0, 0, 0])
        mask = det.get("mask")
        conf_tier = det.get("confidence_tier", {})
        det_warnings = det.get("detection_warnings", [])

        # Use CLIP subtype hint if user didn't specify subtype
        subtype_hint = det.get("subtype_hint")
        subtype = user_subtype or subtype_hint

        # Known object key from CLIP (for direct mass lookup)
        known_object_key = det.get("known_object_key")

        mw = manual_weight_kg if (manual_weight_kg and len(detections) == 1) else None
        size_data = estimate_size_and_mass(
            save_path,
            box if any(box) else [0, 0, 0, 0],
            waste_type,
            subtype,
            manual_weight_kg=mw,
            ref_type=ref_type,
            known_object_key=known_object_key,
        )

        # Merge size warnings with detection warnings
        all_warnings = det_warnings + size_data.get("warnings", [])

        # Energy Calculation (with real-world modifiers)
        energy = calculate_energy(
            size_data["mass_kg"], waste_type, subtype,
            contamination=contamination,
            moisture_pct=moisture_pct,
        )

        # Environmental Impact
        env = calculate_environmental_impact(
            size_data["mass_kg"], energy["best_realistic_kwh"], waste_type, subtype
        )

        # Recommendation
        rec = generate_recommendation(
            size_data["mass_kg"], energy["pathways"], env, waste_type, subtype
        )

        # Save to DB
        record = WasteRecord(
            session_id=session_id,
            object_index=idx,
            image_path=f"/uploads/{filename}",
            annotated_image_path=f"/uploads/{ann_filename}",
            waste_type=waste_type,
            waste_subtype=subtype or "",
            confidence=confidence,
            confidence_level=conf_tier.get("level", "unknown"),
            mask=json.dumps(mask.tolist() if hasattr(mask, "tolist") else mask),
            estimated_area_cm2=size_data.get("area_cm2", 0),
            estimated_volume_m3=size_data.get("volume_m3", 0),
            estimated_mass_kg=size_data["mass_kg"],
            estimation_method=size_data.get("estimation_method", "vision"),
            mass_confidence_pct=size_data.get("confidence_pct", 0),
            manual_weight_kg=mw,
            energy_incineration_kwh=energy["pathways"]["incineration"]["energy_kwh"],
            energy_pyrolysis_kwh=energy["pathways"]["pyrolysis"]["energy_kwh"],
            energy_biogas_kwh=energy["pathways"]["biogas"]["energy_kwh"],
            energy_gasification_kwh=energy["pathways"]["gasification"]["energy_kwh"],
            energy_plasma_kwh=energy["pathways"]["plasma_arc"]["energy_kwh"],
            energy_recycling_kwh=energy["pathways"]["recycling"]["energy_kwh"],
            best_method=energy["best_method"],
            best_energy_kwh=energy["best_energy_kwh"],
            best_realistic_kwh=energy["best_realistic_kwh"],
            co2_saved_kg=env["co2_saved_kg"],
            methane_saved_kg=env["methane_saved_kg"],
            water_saved_liters=env["water_saved_liters"],
            landfill_diverted_m3=env["landfill_diverted_m3"],
            trees_equivalent=env["trees_equivalent"],
            homes_powered_days=env["homes_powered_days"],
            toxic_leachate_liters=env["toxic_leachate_liters"],
            soil_saved_m2=env["soil_saved_m2"],
            recommendation_text=rec["text"],
            is_hazardous=rec.get("is_hazardous", False),
            is_recyclable=rec.get("is_recyclable", False),
            detection_warnings=json.dumps(all_warnings) if all_warnings else None,
        )
        db.add(record)
        db.flush()  # get record.id without full commit
        record_ids.append(record.id)

        objects_results.append({
            "object_index": idx,
            "record_id": record.id,
            "waste_type": waste_type,
            "waste_subtype": subtype or "",
            "confidence": round(confidence, 3),
            "confidence_level": conf_tier.get("level", "unknown"),
            "confidence_color": conf_tier.get("color", [128, 128, 128]),
            "bbox": det.get("bbox") or det.get("box"),
            "mass_kg": round(size_data["mass_kg"], 4),
            "mass_range": size_data.get("mass_range", {}),
            "estimation_method": size_data.get("estimation_method", "vision"),
            "pile_fraction": det.get("pile_fraction"),
            "size": size_data,
            "energy": energy,
            "environmental": env,
            "recommendation": rec,
            "warnings": all_warnings,
        })

    db.commit()

    # --- 5. Aggregate totals across all objects ----
    total_mass = sum(o["mass_kg"] for o in objects_results)
    total_energy = sum(o["energy"]["best_realistic_kwh"] for o in objects_results)
    total_co2 = sum(o["environmental"]["co2_saved_kg"] for o in objects_results)

    # Use first object as "primary" for backward compat
    primary = objects_results[0]

    return JSONResponse(_sanitize({
        "success": True,
        "session_id": session_id,
        "objects_count": len(objects_results),
        "objects": objects_results,
        # Density / pile analysis
        "density": None,
        # Backward-compatible fields (primary object)
        "record_id": primary["record_id"],
        "waste_type": primary["waste_type"],
        "waste_subtype": primary["waste_subtype"],
        "confidence": primary["confidence"],
        "confidence_level": primary["confidence_level"],
        "mass_kg": primary["mass_kg"],
        "size": primary["size"],
        "energy": primary["energy"],
        "environmental": primary["environmental"],
        "recommendation": primary["recommendation"],
        "warnings": primary["warnings"],
        # Aggregates
        "totals": {
            "mass_kg": round(total_mass, 4),
            "energy_kwh": round(total_energy, 4),
            "co2_saved_kg": round(total_co2, 4),
        },
        "images": {
            "original": f"/uploads/{filename}",
            "annotated": f"/uploads/{ann_filename}",
        },
        "subtypes_available": get_subtypes_for_category(primary["waste_type"]),
    }))


@router.get("/subtypes/{category}")
async def get_subtypes(category: str):
    subtypes = get_subtypes_for_category(category)
    return {"category": category, "subtypes": {s["key"]: s["name"] for s in subtypes}}
