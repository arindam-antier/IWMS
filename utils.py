"""
Utility to create audit log entries consistently across all routes.
"""

from sqlalchemy.orm import Session
from models import AuditLog, WorkflowStage
from typing import Optional


def log_action(
    db: Session,
    action: str,
    detail: str = None,
    student_id: int = None,
    performed_by: int = None,
    stage: WorkflowStage = None,
):
    entry = AuditLog(
        action=action,
        detail=detail,
        student_id=student_id,
        performed_by=performed_by,
        stage=stage,
    )
    db.add(entry)
    # caller is responsible for db.commit()
