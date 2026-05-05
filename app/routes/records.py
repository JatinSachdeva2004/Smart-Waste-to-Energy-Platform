"""
Records route — history table, single record detail, delete.
"""
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.waste_record import WasteRecord

router = APIRouter()


@router.get("/history", response_class=HTMLResponse)
async def history_page(request: Request):
    return request.app.state.templates.TemplateResponse("history.html", {"request": request})


@router.get("/api/records")
async def list_records(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    records = (
        db.query(WasteRecord)
        .order_by(WasteRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"records": [_serialize(r) for r in records]}


@router.get("/api/records/{record_id}")
async def get_record(record_id: int, db: Session = Depends(get_db)):
    r = db.query(WasteRecord).filter(WasteRecord.id == record_id).first()
    if not r:
        raise HTTPException(404, "Record not found")
    return _serialize(r)


@router.delete("/api/records/{record_id}")
async def delete_record(record_id: int, db: Session = Depends(get_db)):
    r = db.query(WasteRecord).filter(WasteRecord.id == record_id).first()
    if not r:
        raise HTTPException(404, "Record not found")
    db.delete(r)
    db.commit()
    return {"deleted": True}


def _serialize(r: WasteRecord) -> dict:
    return {
        "id": r.id,
        "waste_type": r.waste_type,
        "waste_subtype": r.waste_subtype,
        "confidence": r.confidence,
        "estimated_mass_kg": r.estimated_mass_kg,
        "best_method": r.best_method,
        "best_energy_kwh": r.best_energy_kwh,
        "co2_saved_kg": r.co2_saved_kg,
        "methane_saved_kg": r.methane_saved_kg,
        "water_saved_liters": r.water_saved_liters,
        "landfill_diverted_m3": r.landfill_diverted_m3,
        "trees_equivalent": r.trees_equivalent,
        "homes_powered_days": r.homes_powered_days,
        "toxic_leachate_liters": r.toxic_leachate_liters,
        "soil_saved_m2": r.soil_saved_m2,
        "image_path": r.image_path,
        "annotated_image_path": r.annotated_image_path,
        "recommendation_text": r.recommendation_text,
        "is_hazardous": r.is_hazardous,
        "is_recyclable": r.is_recyclable,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
