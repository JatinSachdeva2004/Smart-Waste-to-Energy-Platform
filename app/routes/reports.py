"""
Reports route — generate & download PDF reports.
"""
import os
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.waste_record import WasteRecord
from app.models.energy_report import EnergyReport
from app.services.report_generator import generate_pdf_report

router = APIRouter()


@router.post("/api/reports/generate")
async def generate_report(db: Session = Depends(get_db)):
    records = db.query(WasteRecord).order_by(WasteRecord.created_at.desc()).all()
    data = [
        {
            "waste_type": r.waste_type,
            "estimated_mass_kg": r.estimated_mass_kg,
            "best_energy_kwh": r.best_energy_kwh,
            "co2_saved_kg": r.co2_saved_kg,
            "best_method": r.best_method,
        }
        for r in records
    ]
    filepath = generate_pdf_report(data, "All Time")

    total_mass = sum(d["estimated_mass_kg"] for d in data)
    total_energy = sum(d["best_energy_kwh"] for d in data)
    total_co2 = sum(d["co2_saved_kg"] for d in data)

    report = EnergyReport(
        report_type="full",
        total_records=len(data),
        total_waste_kg=total_mass,
        total_energy_kwh=total_energy,
        total_co2_saved_kg=total_co2,
        file_path=filepath,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {"report_id": report.id, "file": filepath}


@router.get("/api/reports/{report_id}/download")
async def download_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(EnergyReport).filter(EnergyReport.id == report_id).first()
    if not report or not os.path.exists(report.file_path):
        return JSONResponse({"error": "Report not found"}, status_code=404)
    return FileResponse(report.file_path, media_type="application/pdf",
                        filename=os.path.basename(report.file_path))
