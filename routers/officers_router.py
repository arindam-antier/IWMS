"""
/api/officers  — Super Admin manages officer accounts (create, list, update, activate, deactivate)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from auth import hash_password, require_admin, get_current_user
from database import get_db
from models import User, UserRole, Notification
from schemas import OfficerCreate, OfficerUpdate, UserOut, MessageResponse
from utils import log_action

router = APIRouter(prefix="/api/officers", tags=["Officers"])


def _notify_admin(db: Session, admin_id: int, title: str, message: str):
    """Send a notification to the super admin."""
    notif = Notification(
        user_id=admin_id,
        title=title,
        message=message,
    )
    db.add(notif)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_officer(
    payload: OfficerCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Super Admin creates a new officer account for any stage role."""
    if payload.role in (UserRole.STUDENT, UserRole.SUPER_ADMIN):
        raise HTTPException(400, "Cannot create STUDENT or SUPER_ADMIN via this endpoint.")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Email already registered.")

    if payload.employee_id:
        if db.query(User).filter(User.employee_id == payload.employee_id).first():
            raise HTTPException(409, "Employee ID already taken.")

    officer = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        employee_id=payload.employee_id,
        specialisation=payload.specialisation,
        experience_years=payload.experience_years,
    )
    db.add(officer)
    db.flush()

    log_action(
        db,
        action="OFFICER_CREATED",
        detail=f"{payload.role.value} account created for {payload.full_name} ({payload.email})",
        performed_by=admin.id,
    )
    db.commit()
    db.refresh(officer)
    return officer


@router.get("", response_model=List[UserOut])
def list_officers(
    role: UserRole = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all officers (and super admin), optionally filtered by role."""
    q = db.query(User).filter(User.role != UserRole.STUDENT)
    if role:
        q = q.filter(User.role == role)
    return q.order_by(User.created_at.desc()).all()


@router.get("/for-stage", response_model=List[UserOut])
def officers_for_stage(
    stage: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return active officers whose role matches the given workflow stage.
    Accessible by ANY authenticated user — used so that the current stage officer
    can pick the next officer themselves without needing Super Admin privileges.

    stage values: reception, enquiry, counsellor, admission, enrollment, visa
    """
    stage_role_map = {
        "reception":  UserRole.RECEPTIONIST,
        "enquiry":    UserRole.ENQUIRY,
        "counsellor": UserRole.COUNSELLOR,
        "admission":  UserRole.ADMISSION,
        "enrollment": UserRole.ENROLLMENT,
        "visa":       UserRole.VISA,
    }
    target_role = stage_role_map.get(stage)
    if not target_role:
        raise HTTPException(400, f"Unknown stage '{stage}'. Valid: {list(stage_role_map.keys())}")

    officers = (
        db.query(User)
        .filter(User.role == target_role, User.is_active == True)
        .order_by(User.full_name)
        .all()
    )
    return officers



@router.get("/{officer_id}", response_model=UserOut)
def get_officer(
    officer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    officer = db.query(User).filter(User.id == officer_id).first()
    if not officer:
        raise HTTPException(404, "Officer not found.")
    return officer


@router.patch("/{officer_id}", response_model=UserOut)
def update_officer(
    officer_id: int,
    payload: OfficerUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    officer = db.query(User).filter(User.id == officer_id).first()
    if not officer:
        raise HTTPException(404, "Officer not found.")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(officer, field, value)

    log_action(
        db,
        action="OFFICER_UPDATED",
        detail=f"Officer {officer.full_name} updated by admin.",
        performed_by=admin.id,
    )
    db.commit()
    db.refresh(officer)
    return officer


@router.patch("/{officer_id}/deactivate", response_model=MessageResponse)
def deactivate_officer(
    officer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate an officer account (they can no longer log in)."""
    officer = db.query(User).filter(User.id == officer_id).first()
    if not officer:
        raise HTTPException(404, "Officer not found.")
    if not officer.is_active:
        raise HTTPException(400, "Officer is already inactive.")

    officer.is_active = False
    log_action(
        db,
        action="OFFICER_DEACTIVATED",
        detail=f"{officer.full_name} ({officer.role.value}) deactivated by admin.",
        performed_by=admin.id,
    )
    db.commit()
    return MessageResponse(message=f"Officer {officer.full_name} has been deactivated.")


@router.patch("/{officer_id}/activate", response_model=MessageResponse)
def activate_officer(
    officer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Re-activate a previously deactivated officer account."""
    officer = db.query(User).filter(User.id == officer_id).first()
    if not officer:
        raise HTTPException(404, "Officer not found.")
    if officer.is_active:
        raise HTTPException(400, "Officer is already active.")

    officer.is_active = True
    log_action(
        db,
        action="OFFICER_ACTIVATED",
        detail=f"{officer.full_name} ({officer.role.value}) re-activated by admin.",
        performed_by=admin.id,
    )
    db.commit()
    return MessageResponse(message=f"Officer {officer.full_name} has been activated.")


# Keep old DELETE endpoint as alias for deactivate (backwards compat)
@router.delete("/{officer_id}", response_model=MessageResponse)
def deactivate_officer_delete(
    officer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    officer = db.query(User).filter(User.id == officer_id).first()
    if not officer:
        raise HTTPException(404, "Officer not found.")
    officer.is_active = False
    log_action(db, "OFFICER_DEACTIVATED",
               f"{officer.full_name} ({officer.role.value}) deactivated.",
               performed_by=admin.id)
    db.commit()
    return MessageResponse(message=f"Officer {officer.full_name} deactivated.")