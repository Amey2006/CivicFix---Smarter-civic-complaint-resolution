import os
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import mongo
from ..auth import get_current_user, require_roles
from ..categories import CATEGORIES, PRIORITIES
from ..config import settings
from ..database import get_db
from ..models import Assignment, Complaint, Deadline, Department, Role, Status, StatusTransition, User, utcnow
from ..schemas import AssignIn, CommentIn, ComplaintIn, DeadlineIn, EscalateIn, InspectionIn, StatusIn
from ..serializers import complaint_detail, complaint_summary
from ..services import workflow

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

STAFF = (Role.OFFICIAL, Role.ADMIN)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def scoped_query(db: Session, user: User):
    q = db.query(Complaint)
    if user.role == Role.CITIZEN:
        q = q.filter(Complaint.citizen_id == user.id)
    elif user.role == Role.OFFICIAL:
        q = q.filter(Complaint.department_id == user.department_id)
    elif user.role == Role.WORKER:
        q = q.join(Assignment).filter(Assignment.worker_id == user.id, Assignment.is_active)
    return q


def get_accessible(db: Session, complaint_id: int, user: User) -> Complaint:
    c = db.get(Complaint, complaint_id)
    if not c:
        raise HTTPException(404, "Complaint not found")
    ok = (
        user.role == Role.ADMIN
        or (user.role == Role.CITIZEN and c.citizen_id == user.id)
        or (user.role == Role.OFFICIAL and c.department_id == user.department_id)
        or (user.role == Role.WORKER and any(a.worker_id == user.id for a in c.assignments))
    )
    if not ok:
        raise HTTPException(403, "You cannot access this complaint")
    return c


@router.post("")
def create_complaint(body: ComplaintIn, db: Session = Depends(get_db),
                     user: User = Depends(require_roles(Role.CITIZEN, Role.ADMIN))):
    cat = CATEGORIES.get(body.category)
    if not cat:
        raise HTTPException(400, "Unknown category")
    if body.priority not in PRIORITIES:
        raise HTTPException(400, "Unknown priority")
    dept = db.query(Department).filter(Department.code == cat["department"]).first()
    if not dept:
        raise HTTPException(500, f"Department {cat['department']} is not configured")

    now = utcnow()
    due = now + timedelta(hours=dept.sla_hours)
    c = Complaint(
        title=body.title, description=body.description, category=body.category,
        priority=body.priority, address=body.address, ward=body.ward,
        latitude=body.latitude, longitude=body.longitude,
        citizen_id=user.id, department_id=dept.id, sla_due_at=due, due_at=due,
    )
    db.add(c)
    db.flush()
    c.ticket_no = f"CF-{now.year}-{c.id:05d}"
    db.add(StatusTransition(complaint_id=c.id, from_status=None, to_status=Status.SUBMITTED,
                            changed_by_id=user.id, note="Complaint submitted"))
    db.add(Deadline(complaint_id=c.id, due_at=due, kind="sla",
                    reason=f"{dept.name} SLA: {dept.sla_hours}h", set_by_id=None))
    db.commit()

    allowed = {f["name"] for f in cat["fields"]}
    mongo.report_details.insert_one({
        "complaint_id": c.id,
        "category": body.category,
        "fields": {k: v for k, v in body.details.items() if k in allowed},
        "created_at": now,
    })
    workflow.system_message(c.id, f"Complaint received and routed to {dept.name}. "
                                  f"Target resolution within {dept.sla_hours} hours.")
    db.refresh(c)
    return complaint_summary(c)


@router.get("")
def list_complaints(
    status: str | None = None, category: str | None = None, department_id: int | None = None,
    priority: str | None = None, escalated: bool | None = None, overdue: bool | None = None,
    search: str | None = None, page: int = 1, page_size: int = 20,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    q = scoped_query(db, user)
    if status:
        q = q.filter(Complaint.status.in_(status.split(",")))
    if category:
        q = q.filter(Complaint.category == category)
    if department_id:
        q = q.filter(Complaint.department_id == department_id)
    if priority:
        q = q.filter(Complaint.priority == priority)
    if escalated:
        q = q.filter(Complaint.escalation_level > 0)
    if overdue:
        q = q.filter(Complaint.status.in_(Status.OPEN), Complaint.due_at < utcnow())
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Complaint.title.ilike(like), Complaint.ticket_no.ilike(like),
                         Complaint.address.ilike(like)))
    total = q.count()
    page_size = min(max(page_size, 1), 100)
    items = (q.order_by(Complaint.created_at.desc())
             .offset((max(page, 1) - 1) * page_size).limit(page_size).all())
    return {"total": total, "page": page, "page_size": page_size,
            "items": [complaint_summary(c) for c in items]}


@router.get("/{complaint_id}")
def get_complaint(complaint_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = get_accessible(db, complaint_id, user)
    data = complaint_detail(c)
    details = mongo.report_details.find_one({"complaint_id": c.id}) or {}
    data["details"] = details.get("fields", {})
    data["photos"] = [mongo.serialize(p) for p in mongo.photos.find({"complaint_id": c.id}).sort("created_at", 1)]
    data["inspections"] = [mongo.serialize(n) for n in
                           mongo.inspection_notes.find({"complaint_id": c.id}).sort("created_at", 1)]
    return data


@router.post("/{complaint_id}/assign")
def assign(complaint_id: int, body: AssignIn, db: Session = Depends(get_db),
           user: User = Depends(require_roles(*STAFF))):
    c = get_accessible(db, complaint_id, user)
    worker = db.get(User, body.worker_id)
    if not worker or worker.role != Role.WORKER or worker.department_id != c.department_id:
        raise HTTPException(400, "Worker must belong to the complaint's department")
    if c.status in (Status.CLOSED, Status.REJECTED, Status.RESOLVED):
        raise HTTPException(400, f"Cannot assign a {c.status} complaint")
    for a in c.assignments:
        a.is_active = False
    db.add(Assignment(complaint_id=c.id, worker_id=worker.id, assigned_by_id=user.id, notes=body.notes))
    db.flush()
    db.refresh(c)
    if c.status in (Status.SUBMITTED, Status.REOPENED):
        workflow.record_transition(db, c, Status.ASSIGNED, user, f"Assigned to {worker.name}")
    workflow.system_message(c.id, f"{user.name} assigned this complaint to {worker.name}.")
    db.commit()
    return complaint_summary(c)


@router.post("/{complaint_id}/status")
def update_status(complaint_id: int, body: StatusIn, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    c = get_accessible(db, complaint_id, user)
    workflow.change_status(db, c, body.status, user, body.note)
    db.commit()
    return complaint_summary(c)


@router.post("/{complaint_id}/deadline")
def extend_deadline(complaint_id: int, body: DeadlineIn, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(*STAFF))):
    c = get_accessible(db, complaint_id, user)
    if c.status not in Status.OPEN:
        raise HTTPException(400, "Deadlines can only be changed on open complaints")
    if body.due_at <= utcnow():
        raise HTTPException(400, "Deadline must be in the future")
    workflow.set_deadline(db, c, body.due_at, "extension", body.reason, user)
    workflow.system_message(c.id, f"Deadline updated by {user.name}: {body.reason}")
    db.commit()
    return complaint_summary(c)


@router.post("/{complaint_id}/escalate")
def manual_escalate(complaint_id: int, body: EscalateIn, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    c = get_accessible(db, complaint_id, user)
    if user.role == Role.WORKER:
        raise HTTPException(403, "Workers cannot escalate complaints")
    if user.role == Role.CITIZEN and not (c.due_at < utcnow() or c.status == Status.ON_HOLD):
        raise HTTPException(400, "You can escalate once the deadline has passed")
    esc = workflow.escalate(db, c, f"{body.reason} (raised by {user.name})", user)
    if not esc:
        raise HTTPException(400, "This complaint cannot be escalated further")
    db.commit()
    return complaint_summary(c)


# ---------- MongoDB-backed collaboration ----------

@router.get("/{complaint_id}/comments")
def list_comments(complaint_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_accessible(db, complaint_id, user)
    query = {"complaint_id": complaint_id}
    if user.role == Role.CITIZEN:
        query["is_internal"] = False
    return [mongo.serialize(d) for d in mongo.discussions.find(query).sort("created_at", 1)]


@router.post("/{complaint_id}/comments")
def add_comment(complaint_id: int, body: CommentIn, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    get_accessible(db, complaint_id, user)
    doc = {
        "complaint_id": complaint_id, "author_id": user.id, "author_name": user.name,
        "author_role": user.role, "message": body.message.strip(),
        "is_internal": body.is_internal and user.role != Role.CITIZEN,
        "system": False, "created_at": utcnow(),
    }
    doc["_id"] = mongo.discussions.insert_one(doc).inserted_id
    return mongo.serialize(doc)


@router.post("/{complaint_id}/inspections")
def add_inspection(complaint_id: int, body: InspectionIn, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(Role.WORKER, Role.OFFICIAL, Role.ADMIN))):
    get_accessible(db, complaint_id, user)
    doc = {
        "complaint_id": complaint_id, "inspector_id": user.id, "inspector_name": user.name,
        "note": body.note, "severity": body.severity, "findings": body.findings,
        "estimated_hours": body.estimated_hours, "created_at": utcnow(),
    }
    doc["_id"] = mongo.inspection_notes.insert_one(doc).inserted_id
    workflow.system_message(complaint_id, f"Inspection note added by {user.name}.")
    return mongo.serialize(doc)


@router.post("/{complaint_id}/photos")
async def upload_photo(complaint_id: int, file: UploadFile = File(...), stage: str = Form("report"),
                       caption: str = Form(""), db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    get_accessible(db, complaint_id, user)
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Only JPEG, PNG, WEBP or GIF images are allowed")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 8 MB")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(os.path.join(settings.UPLOAD_DIR, name), "wb") as fh:
        fh.write(content)
    doc = {
        "complaint_id": complaint_id, "filename": name, "original_name": file.filename,
        "content_type": file.content_type, "size": len(content), "url": f"/uploads/{name}",
        "stage": stage if stage in ("report", "progress", "resolution") else "report",
        "caption": caption, "uploaded_by": user.id, "uploaded_by_name": user.name,
        "created_at": utcnow(),
    }
    doc["_id"] = mongo.photos.insert_one(doc).inserted_id
    return mongo.serialize(doc)
