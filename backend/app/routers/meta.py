from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import hash_password, require_roles
from ..categories import CATEGORIES, ESCALATION_LEVELS, PRIORITIES
from ..database import get_db
from ..models import Department, Role, User
from ..schemas import DepartmentIn, StaffIn
from ..serializers import department_out, user_out

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/meta")
def meta():
    return {"categories": CATEGORIES, "priorities": PRIORITIES, "escalation_levels": ESCALATION_LEVELS}


@router.get("/departments")
def list_departments(db: Session = Depends(get_db)):
    return [department_out(d) for d in db.query(Department).order_by(Department.name)]


@router.post("/departments")
def create_department(body: DepartmentIn, db: Session = Depends(get_db),
                      _: User = Depends(require_roles(Role.ADMIN))):
    d = Department(**body.model_dump())
    d.code = d.code.upper()
    db.add(d)
    db.commit()
    return department_out(d)


@router.get("/departments/{dept_id}/workers")
def department_workers(dept_id: int, db: Session = Depends(get_db),
                       _: User = Depends(require_roles(Role.OFFICIAL, Role.ADMIN))):
    workers = (db.query(User)
               .filter(User.department_id == dept_id, User.role == Role.WORKER, User.is_active)
               .order_by(User.name))
    return [user_out(w) for w in workers]


@router.get("/users")
def list_users(role: str | None = None, db: Session = Depends(get_db),
               _: User = Depends(require_roles(Role.ADMIN))):
    q = db.query(User).order_by(User.role, User.name)
    if role:
        q = q.filter(User.role == role)
    return [user_out(u) for u in q]


@router.post("/users")
def create_staff(body: StaffIn, db: Session = Depends(get_db),
                 _: User = Depends(require_roles(Role.ADMIN))):
    if body.role not in (Role.WORKER, Role.OFFICIAL, Role.ADMIN):
        raise HTTPException(400, "Invalid staff role")
    if body.role != Role.ADMIN and not body.department_id:
        raise HTTPException(400, "Workers and officials need a department")
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(400, "Email already in use")
    u = User(name=body.name, email=body.email.lower(), phone=body.phone, role=body.role,
             department_id=body.department_id, password_hash=hash_password(body.password))
    db.add(u)
    db.commit()
    return user_out(u)
