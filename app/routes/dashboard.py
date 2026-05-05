"""
Dashboard route — serves the main dashboard page + summary stats API.
"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.database import get_db
from app.models.waste_record import WasteRecord

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return request.app.state.templates.TemplateResponse("index.html", {"request": request})


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    return request.app.state.templates.TemplateResponse("dashboard.html", {"request": request})


@router.get("/api/dashboard/stats")
async def dashboard_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(WasteRecord.id)).scalar() or 0
    total_mass = db.query(func.sum(WasteRecord.estimated_mass_kg)).scalar() or 0
    total_energy = db.query(func.sum(WasteRecord.best_energy_kwh)).scalar() or 0
    total_co2 = db.query(func.sum(WasteRecord.co2_saved_kg)).scalar() or 0
    total_water = db.query(func.sum(WasteRecord.water_saved_liters)).scalar() or 0
    total_methane = db.query(func.sum(WasteRecord.methane_saved_kg)).scalar() or 0

    # Waste type distribution
    type_dist = (
        db.query(WasteRecord.waste_type, func.count(WasteRecord.id))
        .group_by(WasteRecord.waste_type)
        .all()
    )
    # Best method distribution
    method_dist = (
        db.query(WasteRecord.best_method, func.count(WasteRecord.id))
        .group_by(WasteRecord.best_method)
        .all()
    )

    return {
        "total_records": total,
        "total_mass_kg": round(total_mass, 3),
        "total_energy_kwh": round(total_energy, 4),
        "total_co2_saved_kg": round(total_co2, 4),
        "total_water_saved_liters": round(total_water, 3),
        "total_methane_saved_kg": round(total_methane, 4),
        "waste_type_distribution": {wt: c for wt, c in type_dist},
        "method_distribution": {m: c for m, c in method_dist},
    }
