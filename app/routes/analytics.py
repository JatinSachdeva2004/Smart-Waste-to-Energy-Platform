"""
Analytics route — trend data, forecasting, charts.
"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.forecasting import get_daily_aggregates, forecast_next_days

router = APIRouter()


@router.get("/analytics", response_class=HTMLResponse)
async def analytics_page(request: Request):
    return request.app.state.templates.TemplateResponse("analytics.html", {"request": request})


@router.get("/api/analytics/trends")
async def trends(days: int = 30):
    return {"aggregates": get_daily_aggregates(days)}


@router.get("/api/analytics/forecast")
async def forecast(history_days: int = 30, ahead: int = 7):
    preds = forecast_next_days(history_days, ahead)
    return {"predictions": preds}
