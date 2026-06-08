"""
/api/auth  — Login for all 8 roles (officers use email, students use student_code or email)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import verify_password, create_access_token, get_current_user
from database import get_db
from models import User, Student, UserRole
from schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Universal login. Accepts:
    - Officers / Admin  → username = email
    - Students          → username = email  OR  student_code (e.g. STU-10042)
    """
    user: User | None = None

    # 1. Try officer / admin lookup by email
    user = db.query(User).filter(User.email == payload.username).first()

    # 2. Try student login by student_code
    if user is None:
        student = (
            db.query(Student)
            .filter(Student.student_code == payload.username.upper())
            .first()
        )
        if student and student.user_id:
            user = db.query(User).filter(User.id == student.user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact Super Admin.",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role.value})

    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        name=user.full_name,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user
