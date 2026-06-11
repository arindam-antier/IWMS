"""
/api/visa  — Visa decisions (approve / reject / hold).
On rejection, a Refund record is auto-created and forwarded to Super Admin.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import require_visa_officer, require_admin, get_current_user
from database import get_db
from models import (
    User, Student, Refund, RefundStatus,
    WorkflowStage, StageStatus, PaymentStage, STAGE_FEES, Payment
)
from schemas import VisaDecision, RefundReview, RefundOut, StudentOut, MessageResponse
from utils import log_action
from typing import List

router = APIRouter(prefix="/api/visa", tags=["Visa"])


@router.post("/decision", response_model=StudentOut)
def record_visa_decision(
    payload: VisaDecision,
    db: Session = Depends(get_db),
    officer: User = Depends(require_visa_officer),
):
    """
    Visa Officer records a visa decision for a student.
    - VISA_APPROVED  → stage moved to COMPLETED
    - VISA_REJECTED  → Refund record auto-created, student flagged
    - VISA_ON_HOLD   → status updated, stays at VISA stage
    """
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found.")

    if student.current_stage != WorkflowStage.VISA:
        raise HTTPException(400, "Student is not at the Visa stage.")

    student.stage_status = payload.decision

    if payload.decision == StageStatus.VISA_APPROVED:
        student.current_stage = WorkflowStage.COMPLETED
        log_action(
            db,
            action="VISA_APPROVED",
            detail=f"Visa approved by {officer.full_name}. Notes: {payload.notes or '-'}",
            student_id=student.id,
            performed_by=officer.id,
            stage=WorkflowStage.VISA,
        )

    elif payload.decision == StageStatus.VISA_REJECTED:
        # Auto-create refund request
        if not db.query(Refund).filter(Refund.student_id == student.id).first():
            visa_payment = db.query(Payment).filter(
                Payment.student_id == student.id,
                Payment.stage == PaymentStage.VISA,
            ).first()
            refund_amount = visa_payment.amount if visa_payment else STAGE_FEES[PaymentStage.VISA]

            refund = Refund(
                student_id=student.id,
                amount=refund_amount,
                reason="Visa Rejected",
                status=RefundStatus.PENDING_APPROVAL,
            )
            db.add(refund)

        log_action(
            db,
            action="VISA_REJECTED",
            detail=f"Visa rejected by {officer.full_name}. Refund request auto-created. "
                   f"Notes: {payload.notes or '-'}",
            student_id=student.id,
            performed_by=officer.id,
            stage=WorkflowStage.VISA,
        )

    else:  # VISA_ON_HOLD
        log_action(
            db,
            action="VISA_ON_HOLD",
            detail=f"Visa put on hold by {officer.full_name}. Notes: {payload.notes or '-'}",
            student_id=student.id,
            performed_by=officer.id,
            stage=WorkflowStage.VISA,
        )

    db.commit()
    db.refresh(student)
    return student


# ─────────────────────────────────────────────
# Refund management (Super Admin)
# ─────────────────────────────────────────────

@router.get("/refunds", response_model=List[RefundOut])
def list_refunds(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Super Admin — list all refund requests."""
    return db.query(Refund).order_by(Refund.created_at.desc()).all()


@router.patch("/refunds/{refund_id}", response_model=RefundOut)
def review_refund(
    refund_id: int,
    payload: RefundReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Super Admin approves or rejects a refund."""
    refund = db.query(Refund).filter(Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(404, "Refund not found.")

    if refund.status not in (RefundStatus.PENDING_APPROVAL,):
        raise HTTPException(400, f"Refund already {refund.status.value}.")

    refund.status = payload.status
    refund.admin_notes = payload.admin_notes
    refund.reviewed_by = admin.id
    refund.reviewed_at = datetime.now(timezone.utc)

    log_action(
        db,
        action=f"REFUND_{payload.status.value.upper()}",
        detail=f"₹{refund.amount:,.0f} refund {payload.status.value} by admin. "
               f"Notes: {payload.admin_notes or '-'}",
        student_id=refund.student_id,
        performed_by=admin.id,
    )
    db.commit()
    db.refresh(refund)
    return refund
