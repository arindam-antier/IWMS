"""
/api/admin  — Super Admin dashboard statistics and system overview.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import require_admin
from database import get_db
from models import User, Student, Payment, Refund, WorkflowStage, UserRole, RefundStatus

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


@router.get("/stats")
def system_stats(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """High-level KPIs for the admin dashboard."""
    total_students = db.query(func.count(Student.id)).scalar()
    total_officers = db.query(func.count(User.id)).filter(
        User.role != UserRole.STUDENT,
        User.role != UserRole.SUPER_ADMIN,
    ).scalar()

    students_by_stage = {
        stage.value: db.query(func.count(Student.id))
        .filter(Student.current_stage == stage)
        .scalar()
        for stage in WorkflowStage
    }

    total_revenue = db.query(func.sum(Payment.amount)).scalar() or 0.0
    pending_refunds = db.query(func.count(Refund.id)).filter(
        Refund.status == RefundStatus.PENDING_APPROVAL
    ).scalar()

    return {
        "total_students":    total_students,
        "total_officers":    total_officers,
        "students_by_stage": students_by_stage,
        "total_revenue":     total_revenue,
        "pending_refunds":   pending_refunds,
    }


@router.get("/officers/workload")
def officer_workload(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """How many active students each officer is handling."""
    from models import Assignment
    rows = (
        db.query(User.id, User.full_name, User.role, func.count(Assignment.id))
        .join(Assignment, Assignment.officer_id == User.id)
        .filter(Assignment.is_active == True)
        .group_by(User.id)
        .all()
    )
    return [
        {"officer_id": r[0], "name": r[1], "role": r[2].value, "active_students": r[3]}
        for r in rows
    ]
