"""
SQLAlchemy ORM models for the Immigration Workflow Management System.
Tables: users, students, assignments, documents, payments, audit_logs, refunds, notifications
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Enum, DateTime, Float,
    ForeignKey, Text, Boolean, func
)
from sqlalchemy.orm import relationship, DeclarativeBase
import enum


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────
# Enumerations
# ─────────────────────────────────────────────

class UserRole(str, enum.Enum):
    SUPER_ADMIN   = "super_admin"
    RECEPTIONIST  = "receptionist"
    ENQUIRY       = "enquiry_officer"
    COUNSELLOR    = "counsellor"
    ADMISSION     = "admission_officer"
    ENROLLMENT    = "enrollment_officer"
    VISA          = "visa_officer"
    STUDENT       = "student"


class WorkflowStage(str, enum.Enum):
    RECEPTION  = "reception"
    ENQUIRY    = "enquiry"
    COUNSELLOR = "counsellor"
    ADMISSION  = "admission"
    ENROLLMENT = "enrollment"
    VISA       = "visa"
    COMPLETED  = "completed"


class StageStatus(str, enum.Enum):
    # Generic
    PENDING    = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED  = "completed"
    # Admission-specific
    ADMISSION_IN_PROGRESS = "admission_in_progress"
    ADMISSION_COMPLETED   = "admission_completed"
    # Enrollment-specific
    ENROLLMENT_IN_PROGRESS = "enrollment_in_progress"
    ENROLLMENT_COMPLETED   = "enrollment_completed"
    # Visa-specific
    VISA_IN_PROGRESS = "visa_in_progress"
    VISA_APPROVED    = "visa_approved"
    VISA_REJECTED    = "visa_rejected"
    VISA_ON_HOLD     = "visa_on_hold"


class PaymentStage(str, enum.Enum):
    REGISTRATION = "registration"   # ₹5,000
    COUNSELLING  = "counselling"    # ₹10,000
    ADMISSION    = "admission"      # ₹20,000
    ENROLLMENT   = "enrollment"     # ₹15,000
    VISA         = "visa"           # ₹25,000


class PaymentMode(str, enum.Enum):
    CASH          = "cash"
    UPI           = "upi"
    CARD          = "card"
    BANK_TRANSFER = "bank_transfer"


class RefundStatus(str, enum.Enum):
    PENDING_APPROVAL = "pending_approval"
    APPROVED         = "approved"
    REJECTED         = "rejected"
    PAID             = "paid"


class DocumentType(str, enum.Enum):
    PASSPORT              = "passport"
    PHOTOGRAPH            = "photograph"
    MARKSHEET_10          = "marksheet_10"
    MARKSHEET_12          = "marksheet_12"
    GRADUATION_DOCS       = "graduation_docs"
    RESUME                = "resume"
    COUNSELLING_NOTES     = "counselling_notes"
    UNIVERSITY_SHORTLIST  = "university_shortlist"
    SOP                   = "sop"
    LOR                   = "lor"
    OFFER_LETTER          = "offer_letter"
    APPLICATION_DOCS      = "application_docs"
    ENROLLMENT_LETTER     = "enrollment_letter"
    TUITION_FEE_RECEIPT   = "tuition_fee_receipt"
    CONFIRMATION_LETTER   = "confirmation_letter"
    VISA_FORM             = "visa_form"
    BANK_STATEMENT        = "bank_statement"
    FINANCIAL_DOCS        = "financial_docs"
    VISA_DECISION_LETTER  = "visa_decision_letter"


# ─────────────────────────────────────────────
# Fee constants
# ─────────────────────────────────────────────
STAGE_FEES = {
    PaymentStage.REGISTRATION: 5000.0,
    PaymentStage.COUNSELLING:  10000.0,
    PaymentStage.ADMISSION:    20000.0,
    PaymentStage.ENROLLMENT:   15000.0,
    PaymentStage.VISA:         25000.0,
}


# ─────────────────────────────────────────────
# USERS  (officers + super admin)
# ─────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    full_name     = Column(String(120), nullable=False)
    email         = Column(String(180), unique=True, index=True, nullable=False)
    phone         = Column(String(20))
    hashed_password = Column(String(256), nullable=False)
    role          = Column(Enum(UserRole), nullable=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=func.now())
    updated_at    = Column(DateTime, default=func.now(), onupdate=func.now())

    # Extra fields for officers
    employee_id   = Column(String(40), unique=True, nullable=True)
    specialisation = Column(String(120), nullable=True)   # counsellor: UK/Europe etc.
    experience_years = Column(Integer, nullable=True)

    # Relationships
    assigned_students = relationship(
        "Assignment", back_populates="officer",
        foreign_keys="Assignment.officer_id"
    )
    payments_collected = relationship("Payment", back_populates="collected_by_user")
    audit_logs_created = relationship("AuditLog", back_populates="performed_by_user")
    notifications      = relationship("Notification", back_populates="user")


# ─────────────────────────────────────────────
# STUDENTS
# ─────────────────────────────────────────────
class Student(Base):
    __tablename__ = "students"

    id             = Column(Integer, primary_key=True, index=True)
    student_code   = Column(String(20), unique=True, index=True)   # STU-10042
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Personal info
    first_name     = Column(String(80), nullable=False)
    last_name      = Column(String(80), nullable=False)
    email          = Column(String(180), unique=True, index=True, nullable=False)
    phone          = Column(String(20))
    date_of_birth  = Column(String(20))
    address        = Column(Text)
    passport_number = Column(String(30))

    # Academic / preference
    target_country = Column(String(80))
    target_course  = Column(String(120))
    target_university = Column(String(200))

    # Workflow
    current_stage  = Column(Enum(WorkflowStage), default=WorkflowStage.RECEPTION)
    stage_status   = Column(Enum(StageStatus), default=StageStatus.PENDING)

    # Registration
    registered_by  = Column(Integer, ForeignKey("users.id"))
    registered_at  = Column(DateTime, default=func.now())
    updated_at     = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user           = relationship("User", foreign_keys=[user_id])
    registered_by_user = relationship("User", foreign_keys=[registered_by])
    assignments    = relationship("Assignment", back_populates="student")
    documents      = relationship("Document", back_populates="student")
    payments       = relationship("Payment", back_populates="student")
    audit_logs     = relationship("AuditLog", back_populates="student")
    refund         = relationship("Refund", back_populates="student", uselist=False)
    notifications  = relationship("Notification", back_populates="student")


# ─────────────────────────────────────────────
# ASSIGNMENTS  (which officer handles which student at each stage)
# ─────────────────────────────────────────────
class Assignment(Base):
    __tablename__ = "assignments"

    id          = Column(Integer, primary_key=True, index=True)
    student_id  = Column(Integer, ForeignKey("students.id"), nullable=False)
    officer_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    stage       = Column(Enum(WorkflowStage), nullable=False)
    notes       = Column(Text)
    assigned_by = Column(Integer, ForeignKey("users.id"))
    assigned_at = Column(DateTime, default=func.now())
    is_active   = Column(Boolean, default=True)

    student     = relationship("Student", back_populates="assignments")
    officer     = relationship("User", back_populates="assigned_students", foreign_keys=[officer_id])
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])


# ─────────────────────────────────────────────
# DOCUMENTS
# ─────────────────────────────────────────────
class Document(Base):
    __tablename__ = "documents"

    id            = Column(Integer, primary_key=True, index=True)
    student_id    = Column(Integer, ForeignKey("students.id"), nullable=False)
    document_type = Column(Enum(DocumentType), nullable=False)
    file_name     = Column(String(255), nullable=False)
    file_path     = Column(String(512), nullable=False)
    file_size_kb  = Column(Integer)
    mime_type     = Column(String(100))
    stage         = Column(Enum(WorkflowStage))
    notes         = Column(Text)
    uploaded_by   = Column(Integer, ForeignKey("users.id"))
    uploaded_at   = Column(DateTime, default=func.now())

    student       = relationship("Student", back_populates="documents")
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by])


# ─────────────────────────────────────────────
# PAYMENTS
# ─────────────────────────────────────────────
class Payment(Base):
    __tablename__ = "payments"

    id              = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("students.id"), nullable=False)
    stage           = Column(Enum(PaymentStage), nullable=False)
    amount          = Column(Float, nullable=False)
    payment_mode    = Column(Enum(PaymentMode), default=PaymentMode.CASH)
    transaction_ref = Column(String(100))
    collected_by    = Column(Integer, ForeignKey("users.id"))
    paid_at         = Column(DateTime, default=func.now())
    notes           = Column(Text)

    student         = relationship("Student", back_populates="payments")
    collected_by_user = relationship("User", back_populates="payments_collected")


# ─────────────────────────────────────────────
# AUDIT LOGS
# ─────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id             = Column(Integer, primary_key=True, index=True)
    student_id     = Column(Integer, ForeignKey("students.id"), nullable=True)
    performed_by   = Column(Integer, ForeignKey("users.id"), nullable=True)
    action         = Column(String(255), nullable=False)
    detail         = Column(Text)
    stage          = Column(Enum(WorkflowStage), nullable=True)
    created_at     = Column(DateTime, default=func.now())

    student        = relationship("Student", back_populates="audit_logs")
    performed_by_user = relationship("User", back_populates="audit_logs_created")


# ─────────────────────────────────────────────
# REFUNDS
# ─────────────────────────────────────────────
class Refund(Base):
    __tablename__ = "refunds"

    id           = Column(Integer, primary_key=True, index=True)
    student_id   = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    amount       = Column(Float, nullable=False)
    reason       = Column(String(255), default="Visa Rejected")
    status       = Column(Enum(RefundStatus), default=RefundStatus.PENDING_APPROVAL)
    reviewed_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at  = Column(DateTime, nullable=True)
    admin_notes  = Column(Text)
    created_at   = Column(DateTime, default=func.now())
    updated_at   = Column(DateTime, default=func.now(), onupdate=func.now())

    student      = relationship("Student", back_populates="refund")
    reviewer     = relationship("User", foreign_keys=[reviewed_by])


# ─────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    student_id  = Column(Integer, ForeignKey("students.id"), nullable=True)
    title       = Column(String(200), nullable=False)
    message     = Column(Text, nullable=False)
    is_read     = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=func.now())

    user        = relationship("User", back_populates="notifications")
    student     = relationship("Student", back_populates="notifications")
