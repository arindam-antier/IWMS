"""
Pydantic v2 schemas for all API request bodies and response models.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from models import (
    UserRole, WorkflowStage, StageStatus,
    PaymentStage, PaymentMode, RefundStatus, DocumentType
)


# ─────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str           # email or student_code
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    name: str


# ─────────────────────────────────────────────
# User / Officer
# ─────────────────────────────────────────────

class OfficerCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(..., min_length=6)
    role: UserRole
    employee_id: Optional[str] = None
    specialisation: Optional[str] = None
    experience_years: Optional[int] = None


class OfficerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    specialisation: Optional[str] = None
    experience_years: Optional[int] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str]
    role: UserRole
    is_active: bool
    employee_id: Optional[str]
    specialisation: Optional[str]
    experience_years: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Student Registration
# ─────────────────────────────────────────────

class StudentRegister(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    passport_number: Optional[str] = None
    payment_mode: PaymentMode = PaymentMode.CASH
    transaction_ref: Optional[str] = None


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    passport_number: Optional[str] = None
    target_country: Optional[str] = None
    target_course: Optional[str] = None
    target_university: Optional[str] = None


class StudentOut(BaseModel):
    id: int
    student_code: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    date_of_birth: Optional[str]
    address: Optional[str]
    passport_number: Optional[str]
    target_country: Optional[str]
    target_course: Optional[str]
    target_university: Optional[str]
    current_stage: WorkflowStage
    stage_status: StageStatus
    registered_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StudentDetail(StudentOut):
    assignments: List["AssignmentOut"] = []
    documents: List["DocumentOut"] = []
    payments: List["PaymentOut"] = []
    audit_logs: List["AuditLogOut"] = []
    refund: Optional["RefundOut"] = None


# ─────────────────────────────────────────────
# Enquiry Profile (Stage 2)
# ─────────────────────────────────────────────

class EnquiryProfileUpdate(BaseModel):
    target_country: Optional[str] = None
    target_course: Optional[str] = None
    target_university: Optional[str] = None


# ─────────────────────────────────────────────
# Assignments
# ─────────────────────────────────────────────

class AssignmentCreate(BaseModel):
    student_id: int
    officer_id: int
    stage: WorkflowStage
    notes: Optional[str] = None


class AssignmentOut(BaseModel):
    id: int
    student_id: int
    officer_id: int
    stage: WorkflowStage
    notes: Optional[str]
    assigned_at: datetime
    is_active: bool
    officer: Optional[UserOut] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Stage Advancement
# ─────────────────────────────────────────────

class StageAdvanceRequest(BaseModel):
    student_id: int
    next_officer_id: int
    notes: Optional[str] = None


class StageStatusUpdate(BaseModel):
    stage_status: StageStatus
    notes: Optional[str] = None


# ─────────────────────────────────────────────
# Documents
# ─────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    student_id: int
    document_type: DocumentType
    file_name: str
    file_size_kb: Optional[int]
    mime_type: Optional[str]
    stage: Optional[WorkflowStage]
    notes: Optional[str]
    uploaded_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Payments
# ─────────────────────────────────────────────

class PaymentCreate(BaseModel):
    student_id: int
    stage: PaymentStage
    payment_mode: PaymentMode = PaymentMode.CASH
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    id: int
    student_id: int
    stage: PaymentStage
    amount: float
    payment_mode: PaymentMode
    transaction_ref: Optional[str]
    paid_at: datetime
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Audit Logs
# ─────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    student_id: Optional[int]
    action: str
    detail: Optional[str]
    stage: Optional[WorkflowStage]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Refunds
# ─────────────────────────────────────────────

class RefundReview(BaseModel):
    status: RefundStatus    # APPROVED or REJECTED
    admin_notes: Optional[str] = None


class RefundOut(BaseModel):
    id: int
    student_id: int
    amount: float
    reason: str
    status: RefundStatus
    admin_notes: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Visa Decision
# ─────────────────────────────────────────────

class VisaDecision(BaseModel):
    student_id: int
    decision: StageStatus     # VISA_APPROVED / VISA_REJECTED / VISA_ON_HOLD
    notes: Optional[str] = None


# ─────────────────────────────────────────────
# Generic responses
# ─────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True
