"""
seed.py — Creates ONLY the Super Admin account on first run.
All officers and students must be added via the Super Admin dashboard.

Run once:  python seed.py
"""

from database import SessionLocal, engine
from models import Base, User, UserRole
from auth import hash_password
from config import get_settings

settings = get_settings()


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── Super Admin only ──────────────────────────────────────────────────
        existing = db.query(User).filter(User.role == UserRole.SUPER_ADMIN).first()
        if existing:
            print(f"ℹ️   Super Admin already exists  →  {existing.email}")
        else:
            admin = User(
                full_name="Super Admin",
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role=UserRole.SUPER_ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"✅  Super Admin created  →  {settings.ADMIN_EMAIL} / {settings.ADMIN_PASSWORD}")

        print("\n🎉  Seed complete.")
        print("    Login as Super Admin and use the Officers page to create officer accounts.")
        print("    Run:  uvicorn main:app --reload")

    except Exception as e:
        db.rollback()
        print(f"❌  Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()