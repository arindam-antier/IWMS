"""
JWT creation/verification, password hashing, and FastAPI auth dependencies.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models import User, UserRole

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ─────────────────────────────────────────────
# Password helpers
# ─────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─────────────────────────────────────────────
# JWT helpers
# ─────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ─────────────────────────────────────────────
# Current user dependencies
# ─────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(token)
    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    return user


def require_roles(*roles: UserRole):
    """Dependency factory — ensures the current user has one of the specified roles."""
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in roles]}",
            )
        return current_user
    return _check


# Convenience role-specific dependencies
require_admin        = require_roles(UserRole.SUPER_ADMIN)
require_receptionist = require_roles(UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
require_enquiry      = require_roles(UserRole.ENQUIRY, UserRole.SUPER_ADMIN)
require_counsellor   = require_roles(UserRole.COUNSELLOR, UserRole.SUPER_ADMIN)
require_admission    = require_roles(UserRole.ADMISSION, UserRole.SUPER_ADMIN)
require_enrollment   = require_roles(UserRole.ENROLLMENT, UserRole.SUPER_ADMIN)
require_visa_officer = require_roles(UserRole.VISA, UserRole.SUPER_ADMIN)
require_student      = require_roles(UserRole.STUDENT, UserRole.SUPER_ADMIN)

require_any_officer = require_roles(
    UserRole.RECEPTIONIST, UserRole.ENQUIRY, UserRole.COUNSELLOR,
    UserRole.ADMISSION, UserRole.ENROLLMENT, UserRole.VISA, UserRole.SUPER_ADMIN
)
