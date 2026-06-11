"""
/api/payments  — Collect and view stage-wise fees.
Fee amounts are fixed; officers record payment mode and optional transaction ref.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from auth import get_current_user, require_any_officer, require_admin
from database import get_db
from models import User, Student, Payment, PaymentStage, WorkflowStage, UserRole, STAGE_FEES
from schemas import PaymentCreate, PaymentOut, MessageResponse
from utils import log_action

router = APIRouter(prefix="/api/payments", tags=["Payments"])

# Map payment stage → workflow stage (for validation)
PAYMENT_STAGE_MAP = {
    PaymentStage.REGISTRATION: WorkflowStage.RECEPTION,
    PaymentStage.COUNSELLING:  WorkflowStage.COUNSELLOR,
    PaymentStage.ADMISSION:    WorkflowStage.ADMISSION,
    PaymentStage.ENROLLMENT:   WorkflowStage.ENROLLMENT,
    PaymentStage.VISA:         WorkflowStage.VISA,
}

# Map payment stage → the officer role that is authorised to collect it.
# Enquiry officers do NOT collect any fee — they only collect documents.
PAYMENT_ROLE_GATE = {
    PaymentStage.REGISTRATION: UserRole.RECEPTIONIST,
    PaymentStage.COUNSELLING:  UserRole.COUNSELLOR,
    PaymentStage.ADMISSION:    UserRole.ADMISSION,
    PaymentStage.ENROLLMENT:   UserRole.ENROLLMENT,
    PaymentStage.VISA:         UserRole.VISA,
}


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def collect_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_officer),
):
    """
    Record a fee payment for a student at a specific stage.
    - Amount is fixed from the fee schedule.
    - Prevents duplicate payments.
    - Enforces that only the correct officer role can collect each fee
      (e.g. only a Counsellor can collect the counselling fee).
    """
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found.")

    # ── Role gate: only the right officer can collect this fee ────────────────
    authorized_role = PAYMENT_ROLE_GATE.get(payload.stage)
    if (
        authorized_role
        and current_user.role not in (authorized_role, UserRole.SUPER_ADMIN)
    ):
        role_label = authorized_role.value.replace("_", " ").title()
        raise HTTPException(
            403,
            f"Only a {role_label} (or Super Admin) can collect the "
            f"{payload.stage.value} fee. "
            f"You are logged in as {current_user.role.value.replace('_', ' ').title()}.",
        )

    # Check for duplicate
    existing = db.query(Payment).filter(
        Payment.student_id == payload.student_id,
        Payment.stage == payload.stage,
    ).first()
    if existing:
        raise HTTPException(409, f"Payment for {payload.stage.value} already recorded.")

    # Validate student is at the right workflow stage
    expected_workflow_stage = PAYMENT_STAGE_MAP.get(payload.stage)
    if (
        expected_workflow_stage
        and student.current_stage != expected_workflow_stage
        and current_user.role != UserRole.SUPER_ADMIN
    ):
        raise HTTPException(
            400,
            f"Student is currently at '{student.current_stage.value}' stage, "
            f"but the {payload.stage.value} fee belongs to '{expected_workflow_stage.value}' stage.",
        )

    amount = STAGE_FEES[payload.stage]
    payment = Payment(
        student_id=payload.student_id,
        stage=payload.stage,
        amount=amount,
        payment_mode=payload.payment_mode,
        transaction_ref=payload.transaction_ref,
        collected_by=current_user.id,
        notes=payload.notes,
    )
    db.add(payment)

    log_action(
        db,
        action="PAYMENT_COLLECTED",
        detail=f"₹{amount:,.0f} for {payload.stage.value} via {payload.payment_mode.value}. "
               f"Ref: {payload.transaction_ref or 'N/A'}",
        student_id=payload.student_id,
        performed_by=current_user.id,
        stage=student.current_stage,
    )
    db.commit()
    db.refresh(payment)
    return payment


@router.get("", response_model=List[PaymentOut])
def list_payments(
    student_id: Optional[int] = Query(None),
    stage: Optional[PaymentStage] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List payments.
    - Students: their own payments only.
    - Officers: all payments (admin sees all, officers see relevant).
    """
    q = db.query(Payment)

    if current_user.role == UserRole.STUDENT:
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student:
            raise HTTPException(404, "Student profile not found.")
        q = q.filter(Payment.student_id == student.id)
    elif student_id:
        q = q.filter(Payment.student_id == student_id)

    if stage:
        q = q.filter(Payment.stage == stage)

    return q.order_by(Payment.paid_at.desc()).offset(skip).limit(limit).all()


@router.get("/summary", response_model=dict)
def payment_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Super Admin — total revenue summary by stage."""
    from sqlalchemy import func as sa_func
    rows = (
        db.query(Payment.stage, sa_func.sum(Payment.amount), sa_func.count(Payment.id))
        .group_by(Payment.stage)
        .all()
    )
    result = {}
    total = 0.0
    for stage, amount, count in rows:
        result[stage.value] = {"total": amount or 0.0, "count": count}
        total += amount or 0.0
    result["grand_total"] = total
    return result