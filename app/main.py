"""
FastAPI application entry point.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import BASE_DIR, UPLOAD_DIR, REPORT_DIR
from app.models.database import init_db

# Import routers
from app.routes.dashboard import router as dashboard_router
from app.routes.upload import router as upload_router
from app.routes.analytics import router as analytics_router
from app.routes.records import router as records_router
from app.routes.reports import router as reports_router
from app.routes.websocket import router as ws_router
from app.routes.insights import router as insights_router

app = FastAPI(
    title="Smart Waste-to-Energy Platform",
    description="AI-powered waste analysis with multi-pathway energy calculation",
    version="1.0.0",
    debug=True,
)

# --- CORS (for Next.js frontend) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static files & templates ---
os.makedirs(os.path.join(BASE_DIR, "static"), exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))
app.state.templates = templates

# --- Routers ---
app.include_router(dashboard_router, tags=["Dashboard"])
app.include_router(upload_router, tags=["Upload"])
app.include_router(analytics_router, tags=["Analytics"])
app.include_router(records_router, tags=["Records"])
app.include_router(reports_router, tags=["Reports"])
app.include_router(ws_router, tags=["WebSocket"])
app.include_router(insights_router)  # /api/insights/*


@app.on_event("startup")
async def startup():
    init_db()
