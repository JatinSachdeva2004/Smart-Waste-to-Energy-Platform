"""
Simple time-series forecasting using linear regression on historical records.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy import func
from app.models.database import SessionLocal
from app.models.waste_record import WasteRecord


def get_daily_aggregates(days: int = 30) -> list[dict]:
    """Return daily totals for waste_kg, energy_kwh, co2_saved_kg over last N days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    with SessionLocal() as db:
        rows = (
            db.query(
                func.date(WasteRecord.created_at).label("day"),
                func.count(WasteRecord.id).label("count"),
                func.sum(WasteRecord.estimated_mass_kg).label("total_mass"),
                func.sum(WasteRecord.best_energy_kwh).label("total_energy"),
                func.sum(WasteRecord.co2_saved_kg).label("total_co2"),
            )
            .filter(WasteRecord.created_at >= cutoff)
            .group_by(func.date(WasteRecord.created_at))
            .order_by(func.date(WasteRecord.created_at))
            .all()
        )
    return [
        {
            "date": str(r.day),
            "count": r.count or 0,
            "total_mass_kg": round(r.total_mass or 0, 3),
            "total_energy_kwh": round(r.total_energy or 0, 4),
            "total_co2_saved_kg": round(r.total_co2 or 0, 4),
        }
        for r in rows
    ]


def forecast_next_days(days_history: int = 30, days_ahead: int = 7) -> list[dict]:
    """
    Simple linear extrapolation based on daily aggregates.
    Returns list of predicted {date, predicted_mass_kg, predicted_energy_kwh}.
    """
    aggregates = get_daily_aggregates(days_history)
    n = len(aggregates)
    if n < 2:
        return []

    # Simple linear regression on mass & energy
    xs = list(range(n))
    masses = [a["total_mass_kg"] for a in aggregates]
    energies = [a["total_energy_kwh"] for a in aggregates]

    m_mass, b_mass = _linear_fit(xs, masses)
    m_energy, b_energy = _linear_fit(xs, energies)

    last_date = datetime.strptime(aggregates[-1]["date"], "%Y-%m-%d")
    predictions = []
    for i in range(1, days_ahead + 1):
        x = n - 1 + i
        pred_date = last_date + timedelta(days=i)
        predictions.append({
            "date": pred_date.strftime("%Y-%m-%d"),
            "predicted_mass_kg": round(max(m_mass * x + b_mass, 0), 3),
            "predicted_energy_kwh": round(max(m_energy * x + b_energy, 0), 4),
        })
    return predictions


def _linear_fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """Least-squares linear fit.  Returns (slope, intercept)."""
    n = len(xs)
    if n == 0:
        return 0.0, 0.0
    sx = sum(xs)
    sy = sum(ys)
    sxx = sum(x * x for x in xs)
    sxy = sum(x * y for x, y in zip(xs, ys))
    denom = n * sxx - sx * sx
    if denom == 0:
        return 0.0, sy / n if n else 0.0
    m = (n * sxy - sx * sy) / denom
    b = (sy - m * sx) / n
    return m, b
