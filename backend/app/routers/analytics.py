from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..categories import CATEGORIES
from ..database import get_db
from ..models import Complaint, Department, Escalation, Role, Status, User, utcnow
from ..serializers import complaint_summary, department_out
from ..services.workflow import run_auto_escalation

router = APIRouter(prefix="/api", tags=["analytics"])


def grade(score: float) -> str:
    for cutoff, letter in ((85, "A"), (70, "B"), (55, "C"), (40, "D")):
        if score >= cutoff:
            return letter
    return "F"


@router.get("/analytics/overview")
def overview(db: Session = Depends(get_db)):
    now = utcnow()
    c = Complaint
    total, done, open_, overdue, escalated, avg_hours = db.query(
        func.count(c.id),
        func.count(c.id).filter(c.status.in_(Status.DONE)),
        func.count(c.id).filter(c.status.in_(Status.OPEN)),
        func.count(c.id).filter(c.status.in_(Status.OPEN), c.due_at < now),
        func.count(c.id).filter(c.escalation_level > 0, c.status.in_(Status.OPEN)),
        func.avg(extract("epoch", c.resolved_at - c.created_at) / 3600),
    ).one()
    return {
        "total": total, "resolved": done, "open": open_, "overdue": overdue,
        "escalated_open": escalated,
        "resolution_rate": round(done / total * 100, 1) if total else 0,
        "avg_resolution_hours": round(float(avg_hours), 1) if avg_hours else None,
    }


@router.get("/analytics/departments")
def department_performance(db: Session = Depends(get_db)):
    """Department-wise resolution scorecard: resolution rate, SLA compliance, escalations."""
    now = utcnow()
    c = Complaint
    rows = (
        db.query(
            Department,
            func.count(c.id),
            func.count(c.id).filter(c.status.in_(Status.DONE)),
            func.count(c.id).filter(c.status.in_(Status.OPEN)),
            func.count(c.id).filter(c.status.in_(Status.OPEN), c.due_at < now),
            func.count(c.id).filter(c.escalation_level > 0),
            func.count(c.id).filter(c.resolved_at.isnot(None), c.resolved_at <= c.sla_due_at),
            func.avg(extract("epoch", c.resolved_at - c.created_at) / 3600),
        )
        .outerjoin(c, c.department_id == Department.id)
        .group_by(Department.id)
        .all()
    )
    out = []
    for d, total, done, open_, overdue, escalated, on_time, avg_h in rows:
        resolution_rate = done / total * 100 if total else 0
        sla_compliance = on_time / done * 100 if done else 0
        escalation_rate = escalated / total * 100 if total else 0
        score = 0.4 * resolution_rate + 0.4 * sla_compliance + 0.2 * (100 - escalation_rate) if total else 0
        out.append({
            "department": department_out(d),
            "total": total, "resolved": done, "open": open_, "overdue": overdue, "escalated": escalated,
            "resolution_rate": round(resolution_rate, 1),
            "sla_compliance": round(sla_compliance, 1),
            "escalation_rate": round(escalation_rate, 1),
            "avg_resolution_hours": round(float(avg_h), 1) if avg_h else None,
            "score": round(score, 1),
            "grade": grade(score) if total else "-",
        })
    out.sort(key=lambda r: r["score"], reverse=True)
    for rank, r in enumerate(out, 1):
        r["rank"] = rank
    return out


@router.get("/analytics/trends")
def trends(days: int = 30, db: Session = Depends(get_db)):
    days = min(max(days, 7), 180)
    start = (utcnow() - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    created_day = func.date(Complaint.created_at)
    resolved_day = func.date(Complaint.resolved_at)
    created = dict(db.query(created_day, func.count()).filter(Complaint.created_at >= start)
                   .group_by(created_day).all())
    resolved = dict(db.query(resolved_day, func.count()).filter(Complaint.resolved_at >= start)
                    .group_by(resolved_day).all())
    esc_day = func.date(Escalation.created_at)
    escalated = dict(db.query(esc_day, func.count()).filter(Escalation.created_at >= start)
                     .group_by(esc_day).all())
    series = []
    for i in range(days):
        day = (start + timedelta(days=i)).date()
        series.append({"date": day.isoformat(), "reported": created.get(day, 0),
                       "resolved": resolved.get(day, 0), "escalated": escalated.get(day, 0)})
    return series


@router.get("/analytics/categories")
def categories(db: Session = Depends(get_db)):
    rows = (db.query(Complaint.category, func.count(),
                     func.count().filter(Complaint.status.in_(Status.DONE)))
            .group_by(Complaint.category).all())
    return [{"category": cat, "label": CATEGORIES.get(cat, {}).get("label", cat),
             "color": CATEGORIES.get(cat, {}).get("color", "#64748b"), "total": total, "resolved": done}
            for cat, total, done in rows]


@router.get("/escalations")
def escalation_board(db: Session = Depends(get_db),
                     user: User = Depends(require_roles(Role.OFFICIAL, Role.ADMIN))):
    q = db.query(Complaint).filter(Complaint.status.in_(Status.OPEN),
                                   (Complaint.escalation_level > 0) | (Complaint.due_at < utcnow()))
    if user.role == Role.OFFICIAL:
        q = q.filter(Complaint.department_id == user.department_id)
    items = q.order_by(Complaint.escalation_level.desc(), Complaint.due_at).all()
    recent = (db.query(Escalation).order_by(Escalation.created_at.desc()).limit(15).all())
    if user.role == Role.OFFICIAL:
        recent = [e for e in recent if e.complaint.department_id == user.department_id]
    return {
        "complaints": [complaint_summary(c) for c in items],
        "recent": [{"id": e.id, "level": e.level, "escalated_to": e.escalated_to, "reason": e.reason,
                    "triggered_by": e.triggered_by, "created_at": e.created_at,
                    "complaint": {"id": e.complaint.id, "ticket_no": e.complaint.ticket_no,
                                  "title": e.complaint.title}}
                   for e in recent],
    }


@router.post("/escalations/run")
def run_escalations(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN, Role.OFFICIAL))):
    return {"escalated": run_auto_escalation(db)}
