"""
/api/documents  — Upload, list, and delete student documents per stage.
Officers can upload; students can view their own.
"""

import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional

from auth import get_current_user, require_any_officer
from database import get_db
from models import User, Student, Document, DocumentType, WorkflowStage, UserRole
from schemas import DocumentOut, MessageResponse
from utils import log_action
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/documents", tags=["Documents"])

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg", "image/png", "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _ensure_upload_dir():
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    student_id: int = Form(...),
    document_type: DocumentType = Form(...),
    stage: Optional[WorkflowStage] = Form(None),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_officer),
):
    """
    Upload a document for a student. Only officers can upload.
    File is stored in the uploads/ directory with a UUID filename.
    """
    # Validate file type
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            400,
            f"Unsupported file type: {file.content_type}. "
            "Allowed: PDF, JPG, PNG, DOC, DOCX"
        )

    # Validate file size
    content = await file.read()
    size_kb = len(content) // 1024
    max_kb = settings.MAX_FILE_SIZE_MB * 1024
    if size_kb > max_kb:
        raise HTTPException(413, f"File too large. Max {settings.MAX_FILE_SIZE_MB} MB.")

    # Validate student
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found.")

    # Save file
    _ensure_upload_dir()
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        student_id=student_id,
        document_type=document_type,
        file_name=file.filename,
        file_path=file_path,
        file_size_kb=size_kb,
        mime_type=file.content_type,
        stage=stage or student.current_stage,
        notes=notes,
        uploaded_by=current_user.id,
    )
    db.add(doc)

    log_action(
        db,
        action="DOCUMENT_UPLOADED",
        detail=f"{document_type.value}: {file.filename} ({size_kb} KB)",
        student_id=student_id,
        performed_by=current_user.id,
        stage=stage or student.current_stage,
    )
    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=List[DocumentOut])
def list_documents(
    student_id: int,
    stage: Optional[WorkflowStage] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all documents for a student (filtered by stage if provided)."""
    # Students can only view their own documents
    if current_user.role == UserRole.STUDENT:
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student or student.id != student_id:
            raise HTTPException(403, "Access denied.")

    q = db.query(Document).filter(Document.student_id == student_id)
    if stage:
        q = q.filter(Document.stage == stage)
    return q.order_by(Document.uploaded_at.desc()).all()


@router.delete("/{doc_id}", response_model=MessageResponse)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_officer),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found.")

    # Remove from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    log_action(db, "DOCUMENT_DELETED", f"{doc.document_type.value}: {doc.file_name} removed.",
               student_id=doc.student_id, performed_by=current_user.id)

    db.delete(doc)
    db.commit()
    return MessageResponse(message="Document deleted.")
