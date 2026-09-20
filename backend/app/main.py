"""
FastAPI Main Application for Transit Assist India.
Provides high-performance, low-latency REST endpoints for public transit commuters.
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session

from backend.app.db.database import get_db, engine, Base
from backend.app.db.models import Stop, Route
from backend.app.api.stops import router as stops_router
from backend.app.api.arrivals import router as arrivals_router
from backend.app.api.plan import router as plan_router
from backend.app.api.routes import router as routes_router
from backend.app.api.reports import router as reports_router
from backend.app.api.realtime import router as realtime_router

# Ensure tables are created if not present
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Transit Assist India API",
    description=(
        "Production-ready public transit backend for Indian commuters. "
        "Supports multimodal trip planning (MTC Bus + CMRL Metro + Suburban Rail), "
        "bilingual search (English + Tamil), scheduled arrivals, crowdsourced delay reports, "
        "and Indian transit fare calculation (stage & slab rules, Vidiyal Payanam)."
    ),
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# GZip compression for low-data network optimization (3G / slow mobile networks)
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS configuration for frontend PWA client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(stops_router)
app.include_router(arrivals_router)
app.include_router(plan_router)
app.include_router(routes_router)
app.include_router(reports_router)
app.include_router(realtime_router)

@app.get("/api/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint returning system status and transit network metrics."""
    stops_count = db.query(Stop).count()
    routes_count = db.query(Route).count()
    return {
        "status": "online",
        "app": "Transit Assist India",
        "city": "Chennai",
        "modes": ["MTC Bus", "CMRL Metro", "Suburban Rail"],
        "languages": ["en", "ta"],
        "total_stops": stops_count,
        "total_routes": routes_count,
    }

@app.get("/api/config/features", tags=["Configuration"])
def get_features():
    """Return active feature flags and city configuration."""
    from backend.app.config import settings
    return {
        "app_name": settings.app_name,
        "city": settings.city,
        "version": settings.version,
        "features": settings.get_feature_flags(),
    }

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to Transit Assist India API",
        "docs": "/docs",
        "health": "/api/health",
    }
