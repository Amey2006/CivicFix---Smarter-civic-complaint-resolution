from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import Role, User
from ..schemas import LoginIn, RegisterIn
from ..serializers import user_out

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(400, "An account with this email already exists")
    user = User(
        name=body.name, email=body.email.lower(), phone=body.phone,
        password_hash=hash_password(body.password), role=Role.CITIZEN,
    )
    db.add(user)
    db.commit()
    return {"token": create_token(user), "user": user_out(user)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_token(user), "user": user_out(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)
