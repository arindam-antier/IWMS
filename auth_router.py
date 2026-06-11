"""
/api/auth  — Login for all 8 roles (officers use email, students use student_code or email)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.orm import Session
from typing import Optional

from auth import verify_password, create_access_token, get_current_user, hash_password, require_admin
from database import get_db
from models import User, Student, UserRole
from schemas import LoginRequest, TokenResponse, UserOut, ChangePasswordRequest, AdminResetPasswordRequest
from utils import log_action

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Cookie name used to store the JWT
COOKIE_NAME = "iwms_token"


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Universal login. Accepts:
    - Officers / Admin  → username = email
    - Students          → username = email  OR  student_code (e.g. STU-10042)

    On success, sets an httpOnly cookie (iwms_token) AND returns the token in the
    response body so the frontend can store it in memory too.
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

    # ── Set httpOnly cookie so the browser stores it securely ──────────────────
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,          # JS cannot read this cookie
        samesite="lax",         # CSRF protection for same-origin
        secure=False,           # Set True in production (HTTPS only)
        max_age=60 * 60 * 8,    # 8 hours (matches ACCESS_TOKEN_EXPIRE_MINUTES)
        path="/",
    )

    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        name=user.full_name,
    )


@router.post("/logout")
def logout(response: Response):
    """Clear the auth cookie on logout."""
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.post("/change-password", response_model=UserOut)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Any logged-in user can change their own password by supplying their current password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password.")
    current_user.hashed_password = hash_password(payload.new_password)
    log_action(db, "PASSWORD_CHANGED", "User changed their own password.", performed_by=current_user.id)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/admin-reset-password", response_model=UserOut)
def admin_reset_password(
    payload: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Super Admin resets any user's password (officers AND students) without
    needing the old password.
    """
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.hashed_password = hash_password(payload.new_password)
    log_action(
        db,
        "PASSWORD_RESET_BY_ADMIN",
        f"Password reset by Super Admin for user {user.full_name} ({user.email}).",
        performed_by=admin.id,
    )
    db.commit()
    db.refresh(user)
    return user