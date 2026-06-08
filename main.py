"""
╔══════════════════════════════════════════════════════════════════╗
║       Immigration Workflow Management System  —  FastAPI         ║
╠══════════════════════════════════════════════════════════════════╣
║  Run:      uvicorn main:app --reload                             ║
║  Docs:     http://127.0.0.1:8000/docs                            ║
║  Seed DB:  python seed.py   (first time only)                    ║
╚══════════════════════════════════════════════════════════════════╝

API surface
──────────────────────────────────────────────────────────────────
POST   /api/auth/login                     → JWT for all 8 roles
GET    /api/auth/me                        → current user profile

GET    /api/students                       → list (role-filtered)
POST   /api/students                       → register student (Reception)
GET    /api/students/me/profile            → student self-view
GET    /api/students/{id}                  → detail + docs/payments/logs
PATCH  /api/students/{id}                  → update profile
PATCH  /api/students/{id}/enquiry-profile  → Stage 2 profile update
PATCH  /api/students/{id}/stage-status     → update status within stage
POST   /api/students/{id}/advance-stage    → advance + assign next officer

POST   /api/documents                      → upload file (multipart)
GET    /api/documents?student_id=          → list documents
DELETE /api/documents/{id}                 → remove document

POST   /api/payments                       → collect fee
GET    /api/payments                       → list (role-filtered)
GET    /api/payments/summary               → revenue breakdown (admin)

POST   /api/visa/decision                  → visa approve/reject/hold
GET    /api/visa/refunds                   → list refunds (admin)
PATCH  /api/visa/refunds/{id}              → approve/reject refund (admin)

GET    /api/officers                       → list officers (admin)
POST   /api/officers                       → create officer account (admin)
GET    /api/officers/{id}                  → officer detail
PATCH  /api/officers/{id}                  → update officer
DELETE /api/officers/{id}                  → deactivate officer

GET    /api/audit                          → audit logs (role-filtered)
GET    /api/notifications                  → user notifications
PATCH  /api/notifications/{id}/read        → mark one read
PATCH  /api/notifications/read-all         → mark all read

GET    /api/admin/stats                    → KPI dashboard (admin)
GET    /api/admin/officers/workload        → per-officer student count
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import get_settings
from database import engine
from models import Base

# Routers
from routers.auth_router    import router as auth_router
from routers.students_router import router as students_router
from routers.documents_router import router as documents_router
from routers.payments_router  import router as payments_router
from routers.visa_router      import router as visa_router
from routers.officers_router  import router as officers_router
from routers.audit_router     import audit_router, notif_router
from routers.admin_router     import router as admin_router

settings = get_settings()


# ─────────────────────────────────────────────
# Startup / Shutdown
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup (migrations handled by Alembic in production)."""
    Base.metadata.create_all(bind=engine)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    print("✅  IWMS API started  →  http://127.0.0.1:8000/docs")
    yield
    print("🛑  IWMS API shutting down.")


# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

app = FastAPI(
    title="Immigration Workflow Management System",
    description=(
        "RESTful API for managing student immigration workflows across 6 stages: "
        "Reception → Enquiry → Counselling → Admission → Enrollment → Visa."
    ),
    version="1.0.0",
    contact={"name": "IWMS Admin", "email": settings.ADMIN_EMAIL},
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ─────────────────────────────────────────────
# Middleware
# ─────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # In production: specify frontend origin(s)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Global exception handler
# ─────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check server logs."},
    )


# ─────────────────────────────────────────────
# Static files (uploaded documents)
# ─────────────────────────────────────────────

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# ─────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(students_router)
app.include_router(documents_router)
app.include_router(payments_router)
app.include_router(visa_router)
app.include_router(officers_router)
app.include_router(audit_router)
app.include_router(notif_router)
app.include_router(admin_router)


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "service": "Immigration Workflow Management System",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    from sqlalchemy import text
    from database import SessionLocal
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception:
        db_status = "error"
    return {"status": "ok", "database": db_status}
