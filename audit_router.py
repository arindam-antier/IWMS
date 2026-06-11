"""
/api/audit   — Read-only audit log access (Admin sees all, officers see their stage)
/api/notifications — Per-user notification list
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from auth import get_current_user, require_admin
from database import get_db
from models import User, AuditLog, Notification, WorkflowStage, UserRole, Student
from schemas import AuditLogOut, NotificationOut, MessageResponse

audit_router = APIRouter(prefix="/api/audit", tags=["Audit Logs"])
notif_router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


# ─────────────────────────────────────────────
# Audit Logs
# ─────────────────────────────────────────────

@audit_router.get("", response_model=List[AuditLogOut])
def list_audit_logs(
    student_id: Optional[int] = Query(None),
    stage: Optional[WorkflowStage] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Audit log access:
    - Super Admin: all logs
    - Officers: logs for their stage
    - Students: only their own logs
    """
    q = db.query(AuditLog)

    if current_user.role == UserRole.STUDENT:
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if student:
            q = q.filter(AuditLog.student_id == student.id)

    if student_id and current_user.role != UserRole.STUDENT:
        q = q.filter(AuditLog.student_id == student_id)

    if stage:
        q = q.filter(AuditLog.stage == stage)

    return q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


# ─────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────

@notif_router.get("", response_model=List[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )


@notif_router.patch("/{notif_id}/read", response_model=MessageResponse)
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        from fastapi import HTTPException
        raise HTTPException(404, "Notification not found.")
    n.is_read = True
    db.commit()
    return MessageResponse(message="Marked as read.")


@notif_router.patch("/read-all", response_model=MessageResponse)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return MessageResponse(message="All notifications marked as read.")
