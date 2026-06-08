"""
/api/students  — Student registration, listing, profile, stage advancement.
Sends Super Admin notifications on: student registration, stage advancement.
Each officer sees only students in their stage. Admin sees all.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from auth import (
    hash_password, get_current_user,
    require_receptionist, require_enquiry, require_counsellor,
    require_admission, require_enrollment, require_visa_officer,
    require_admin, require_any_officer,
)
from database import get_db
from models import (
    User, Student, UserRole, WorkflowStage, StageStatus,
    Assignment, Payment, PaymentStage, STAGE_FEES, Notification
)
from schemas import (
    StudentRegister, StudentUpdate, StudentOut, StudentDetail,
    StageAdvanceRequest, StageStatusUpdate, MessageResponse,
    EnquiryProfileUpdate,
)
from utils import log_action
import random
import string

router = APIRouter(prefix="/api/students", tags=["Students"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _generate_student_code(db: Session) -> str:
    while True:
        code = "STU-" + "".join(random.choices(string.digits, k=5))
        if not db.query(Student).filter(Student.student_code == code).first():
            return code


def _get_student_or_404(db: Session, student_id: int) -> Student:
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found.")
    return s


def _notify_admins(db: Session, title: str, message: str, student_id: int = None):
    """Create a notification for every active Super Admin."""
    admins = db.query(User).filter(
        User.role == UserRole.SUPER_ADMIN,
        User.is_active == True,
    ).all()
    for admin in admins:
        notif = Notification(
            user_id=admin.id,
            student_id=student_id,
            title=title,
            message=message,
        )
        db.add(notif)


STAGE_ORDER = [
    WorkflowStage.RECEPTION,
    WorkflowStage.ENQUIRY,
    WorkflowStage.COUNSELLOR,
    WorkflowStage.ADMISSION,
    WorkflowStage.ENROLLMENT,
    WorkflowStage.VISA,
    WorkflowStage.COMPLETED,
]

STAGE_ADVANCE_ROLE = {
    WorkflowStage.RECEPTION:  UserRole.RECEPTIONIST,
    WorkflowStage.ENQUIRY:    UserRole.ENQUIRY,
    WorkflowStage.COUNSELLOR: UserRole.COUNSELLOR,
    WorkflowStage.ADMISSION:  UserRole.ADMISSION,
    WorkflowStage.ENROLLMENT: UserRole.ENROLLMENT,
    WorkflowStage.VISA:       UserRole.VISA,
}

STAGE_LABELS = {
    WorkflowStage.RECEPTION:  "Reception",
    WorkflowStage.ENQUIRY:    "Enquiry",
    WorkflowStage.COUNSELLOR: "Counselling",
    WorkflowStage.ADMISSION:  "Admission",
    WorkflowStage.ENROLLMENT: "Enrollment",
    WorkflowStage.VISA:       "Visa",
    WorkflowStage.COMPLETED:  "Completed",
}


# ─────────────────────────────────────────────
# Register student (Receptionist)
# ─────────────────────────────────────────────

@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def register_student(
    payload: StudentRegister,
    db: Session = Depends(get_db),
    officer: User = Depends(require_receptionist),
):
    if db.query(Student).filter(Student.email == payload.email).first():
        raise HTTPException(409, "A student with this email already exists.")

    code = _generate_student_code(db)
    student = Student(
        student_code=code,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        date_of_birth=payload.date_of_birth,
        address=payload.address,
        passport_number=payload.passport_number,
        current_stage=WorkflowStage.RECEPTION,
        stage_status=StageStatus.PENDING,
        registered_by=officer.id,
    )
    db.add(student)
    db.flush()

    student_user = User(
        full_name=f"{payload.first_name} {payload.last_name}",
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(code),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(student_user)
    db.flush()
    student.user_id = student_user.id

    assignment = Assignment(
        student_id=student.id,
        officer_id=officer.id,
        stage=WorkflowStage.RECEPTION,
        assigned_by=officer.id,
        is_active=True,
    )
    db.add(assignment)

    payment = Payment(
        student_id=student.id,
        stage=PaymentStage.REGISTRATION,
        amount=STAGE_FEES[PaymentStage.REGISTRATION],
        payment_mode=payload.payment_mode,
        transaction_ref=payload.transaction_ref,
        collected_by=officer.id,
    )
    db.add(payment)

    log_action(
        db,
        action="STUDENT_REGISTERED",
        detail=f"Student {code} ({payload.first_name} {payload.last_name}) registered by {officer.full_name}. "
               f"Reg fee ₹{STAGE_FEES[PaymentStage.REGISTRATION]:,.0f} via {payload.payment_mode}.",
        student_id=student.id,
        performed_by=officer.id,
        stage=WorkflowStage.RECEPTION,
    )

    # Notify all super admins
    _notify_admins(
        db,
        title=f"New Student Registered — {code}",
        message=f"{payload.first_name} {payload.last_name} ({payload.email}) was registered by "
                f"{officer.full_name}. Registration fee ₹{STAGE_FEES[PaymentStage.REGISTRATION]:,.0f} collected.",
        student_id=student.id,
    )

    db.commit()
    db.refresh(student)
    return student


# ─────────────────────────────────────────────
# List students (role-filtered)
# ─────────────────────────────────────────────

@router.get("", response_model=List[StudentOut])
def list_students(
    stage: Optional[WorkflowStage] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Student)

    if current_user.role == UserRole.STUDENT:
        q = q.filter(Student.user_id == current_user.id)

    elif current_user.role != UserRole.SUPER_ADMIN:
        stage_map = {
            UserRole.RECEPTIONIST: WorkflowStage.RECEPTION,
            UserRole.ENQUIRY:      WorkflowStage.ENQUIRY,
            UserRole.COUNSELLOR:   WorkflowStage.COUNSELLOR,
            UserRole.ADMISSION:    WorkflowStage.ADMISSION,
            UserRole.ENROLLMENT:   WorkflowStage.ENROLLMENT,
            UserRole.VISA:         WorkflowStage.VISA,
        }
        officer_stage = stage_map.get(current_user.role)
        if officer_stage:
            q = q.filter(Student.current_stage == officer_stage)

    if stage:
        q = q.filter(Student.current_stage == stage)

    if search:
        like = f"%{search}%"
        q = q.filter(
            Student.first_name.ilike(like) |
            Student.last_name.ilike(like) |
            Student.email.ilike(like) |
            Student.student_code.ilike(like)
        )

    return q.order_by(Student.registered_at.desc()).offset(skip).limit(limit).all()


# ─────────────────────────────────────────────
# Get single student (detail)
# ─────────────────────────────────────────────

@router.get("/me/profile", response_model=StudentDetail)
def my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(403, "Only students can use this endpoint.")

    student = (
        db.query(Student)
        .options(
            joinedload(Student.assignments).joinedload(Assignment.officer),
            joinedload(Student.documents),
            joinedload(Student.payments),
            joinedload(Student.audit_logs),
            joinedload(Student.refund),
        )
        .filter(Student.user_id == current_user.id)
        .first()
    )
    if not student:
        raise HTTPException(404, "Student profile not found.")
    return student


@router.get("/{student_id}", response_model=StudentDetail)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = (
        db.query(Student)
        .options(
            joinedload(Student.assignments).joinedload(Assignment.officer),
            joinedload(Student.documents),
            joinedload(Student.payments),
            joinedload(Student.audit_logs),
            joinedload(Student.refund),
        )
        .filter(Student.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(404, "Student not found.")

    if current_user.role == UserRole.STUDENT and student.user_id != current_user.id:
        raise HTTPException(403, "Access denied.")

    return student


# ─────────────────────────────────────────────
# Update student profile
# ─────────────────────────────────────────────

@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_officer),
):
    student = _get_student_or_404(db, student_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(student, field, value)

    log_action(db, "STUDENT_UPDATED", f"Profile updated by {current_user.full_name}.",
               student_id=student.id, performed_by=current_user.id)
    db.commit()
    db.refresh(student)
    return student


# ─────────────────────────────────────────────
# Enquiry officer — update profile (Stage 2)
# ─────────────────────────────────────────────

@router.patch("/{student_id}/enquiry-profile", response_model=StudentOut)
def update_enquiry_profile(
    student_id: int,
    payload: EnquiryProfileUpdate,
    db: Session = Depends(get_db),
    officer: User = Depends(require_enquiry),
):
    student = _get_student_or_404(db, student_id)
    if student.current_stage != WorkflowStage.ENQUIRY:
        raise HTTPException(400, "Student is not at the Enquiry stage.")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(student, field, value)

    log_action(db, "ENQUIRY_PROFILE_UPDATED",
               f"Country: {payload.target_country}, Course: {payload.target_course}",
               student_id=student.id, performed_by=officer.id, stage=WorkflowStage.ENQUIRY)
    db.commit()
    db.refresh(student)
    return student


# ─────────────────────────────────────────────
# Update stage status
# ─────────────────────────────────────────────

@router.patch("/{student_id}/stage-status", response_model=StudentOut)
def update_stage_status(
    student_id: int,
    payload: StageStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_officer),
):
    student = _get_student_or_404(db, student_id)
    student.stage_status = payload.stage_status

    log_action(db, "STAGE_STATUS_UPDATED",
               f"Status → {payload.stage_status.value}. Notes: {payload.notes or '-'}",
               student_id=student.id, performed_by=current_user.id, stage=student.current_stage)
    db.commit()
    db.refresh(student)
    return student


# ─────────────────────────────────────────────
# Advance to next stage
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# Mark current stage as complete (unlocks advance)
# ─────────────────────────────────────────────

# Statuses that count as "stage complete" for each workflow stage
STAGE_COMPLETE_STATUS = {
    WorkflowStage.RECEPTION:  [StageStatus.COMPLETED],
    WorkflowStage.ENQUIRY:    [StageStatus.COMPLETED],
    WorkflowStage.COUNSELLOR: [StageStatus.COMPLETED],
    WorkflowStage.ADMISSION:  [StageStatus.ADMISSION_COMPLETED],
    WorkflowStage.ENROLLMENT: [StageStatus.ENROLLMENT_COMPLETED],
    WorkflowStage.VISA:       [StageStatus.VISA_APPROVED, StageStatus.VISA_REJECTED],
}


@router.post("/{student_id}/mark-complete", response_model=StudentOut)
def mark_stage_complete(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_officer),
):
    """
    Officer marks the current stage requirements as completed.
    This unlocks the 'advance to next stage' action.
    The correct completion status is set automatically based on the current stage.
    """
    student = _get_student_or_404(db, student_id)

    if student.current_stage == WorkflowStage.COMPLETED:
        raise HTTPException(400, "Student has already completed the full workflow.")

    required_role = STAGE_ADVANCE_ROLE.get(student.current_stage)
    if required_role and current_user.role not in (required_role, UserRole.SUPER_ADMIN):
        raise HTTPException(
            403,
            f"Only a {required_role.value} (or Super Admin) can complete stage {student.current_stage.value}.",
        )

    # Set the right completion status for this stage
    completion_map = {
        WorkflowStage.RECEPTION:  StageStatus.COMPLETED,
        WorkflowStage.ENQUIRY:    StageStatus.COMPLETED,
        WorkflowStage.COUNSELLOR: StageStatus.COMPLETED,
        WorkflowStage.ADMISSION:  StageStatus.ADMISSION_COMPLETED,
        WorkflowStage.ENROLLMENT: StageStatus.ENROLLMENT_COMPLETED,
    }
    complete_status = completion_map.get(student.current_stage)
    if not complete_status:
        raise HTTPException(400, f"Stage {student.current_stage.value} cannot be manually completed here.")

    student.stage_status = complete_status

    stage_label = STAGE_LABELS.get(student.current_stage, student.current_stage.value)
    log_action(
        db,
        action="STAGE_MARKED_COMPLETE",
        detail=f"{stage_label} stage requirements marked complete by {current_user.full_name}. "
               f"Ready to assign next officer.",
        student_id=student.id,
        performed_by=current_user.id,
        stage=student.current_stage,
    )

    _notify_admins(
        db,
        title=f"Stage Complete — {student.student_code}",
        message=f"{student.first_name} {student.last_name} has completed {stage_label} stage. "
                f"Ready to advance. Marked by {current_user.full_name}.",
        student_id=student.id,
    )

    db.commit()
    db.refresh(student)
    return student


@router.post("/{student_id}/advance-stage", response_model=StudentOut)
def advance_stage(
    student_id: int,
    payload: StageAdvanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_officer),
):
    student = _get_student_or_404(db, student_id)

    if student.current_stage == WorkflowStage.COMPLETED:
        raise HTTPException(400, "Student has already completed the workflow.")

    required_role = STAGE_ADVANCE_ROLE.get(student.current_stage)
    if required_role and current_user.role not in (required_role, UserRole.SUPER_ADMIN):
        raise HTTPException(
            403,
            f"Only a {required_role.value} (or Super Admin) can advance from {student.current_stage.value}.",
        )

    # ── GATE: stage must be marked complete before advancing ──────────────────
    complete_statuses = STAGE_COMPLETE_STATUS.get(student.current_stage, [])
    if complete_statuses and student.stage_status not in complete_statuses:
        raise HTTPException(
            400,
            f"Cannot advance: stage '{student.current_stage.value}' must be marked complete first. "
            f"Current status: '{student.stage_status.value}'. "
            f"Use the 'Mark Stage Complete' action.",
        )

    current_idx = STAGE_ORDER.index(student.current_stage)
    next_stage = STAGE_ORDER[current_idx + 1]

    next_officer = db.query(User).filter(User.id == payload.next_officer_id).first()
    if not next_officer:
        raise HTTPException(404, "Next officer not found.")

    expected_role_for_next = STAGE_ADVANCE_ROLE.get(next_stage)
    if (
        expected_role_for_next
        and next_officer.role not in (expected_role_for_next, UserRole.SUPER_ADMIN)
    ):
        raise HTTPException(
            400,
            f"Officer {next_officer.full_name} has role {next_officer.role.value}, "
            f"but stage {next_stage.value} requires a {expected_role_for_next.value}.",
        )

    db.query(Assignment).filter(
        Assignment.student_id == student.id,
        Assignment.stage == student.current_stage,
        Assignment.is_active == True,
    ).update({"is_active": False})

    new_assignment = Assignment(
        student_id=student.id,
        officer_id=next_officer.id,
        stage=next_stage,
        notes=payload.notes,
        assigned_by=current_user.id,
        is_active=True,
    )
    db.add(new_assignment)

    prev_stage = student.current_stage
    student.current_stage = next_stage
    student.stage_status = StageStatus.PENDING

    prev_label = STAGE_LABELS.get(prev_stage, prev_stage.value)
    next_label = STAGE_LABELS.get(next_stage, next_stage.value)

    log_action(
        db,
        action="STAGE_ADVANCED",
        detail=f"Moved {prev_label} → {next_label}. "
               f"Assigned to {next_officer.full_name}. Notes: {payload.notes or '-'}",
        student_id=student.id,
        performed_by=current_user.id,
        stage=next_stage,
    )

    # Notify all super admins
    _notify_admins(
        db,
        title=f"Stage Advanced — {student.student_code}",
        message=f"{student.first_name} {student.last_name} moved from {prev_label} → {next_label}. "
                f"Now assigned to {next_officer.full_name}.",
        student_id=student.id,
    )

    db.commit()
    db.refresh(student)
    return student