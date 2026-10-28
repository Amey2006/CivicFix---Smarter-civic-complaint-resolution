from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import mongo
from ..categories import ESCALATION_LEVELS, MAX_ESCALATION, PRIORITIES
from ..models import Complaint, Deadline, Escalation, Role, Status, StatusTransition, User, utcnow

# Which status changes are legal from each state.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Status.SUBMITTED: {Status.ASSIGNED, Status.REJECTED},
    Status.ASSIGNED: {Status.IN_PROGRESS, Status.ON_HOLD, Status.REJECTED},
    Status.IN_PROGRESS: {Status.RESOLVED, Status.ON_HOLD},
    Status.ON_HOLD: {Status.IN_PROGRESS},
    Status.RESOLVED: {Status.CLOSED, Status.REOPENED},
    Status.REOPENED: {Status.ASSIGNED, Status.IN_PROGRESS},
    Status.CLOSED: set(),
    Status.REJECTED: set(),
}

# Statuses each role may move a complaint into (officials/admins: anything legal).
ROLE_TARGETS: dict[str, set[str]] = {
    Role.WORKER: {Status.IN_PROGRESS, Status.ON_HOLD, Status.RESOLVED},
    Role.CITIZEN: {Status.CLOSED, Status.REOPENED},
}


def system_message(complaint_id: int, message: str) -> None:
    mongo.discussions.insert_one({
        "complaint_id": complaint_id,
        "author_id": None,
        "author_name": "CivicFix",
        "author_role": "system",
        "message": message,
        "is_internal": False,
        "system": True,
        "created_at": utcnow(),
    })


def record_transition(db: Session, c: Complaint, to_status: str, actor: User | None, note: str | None = None) -> None:
    db.add(StatusTransition(
        complaint_id=c.id, from_status=c.status, to_status=to_status,
        changed_by_id=actor.id if actor else None, note=note,
    ))
    c.status = to_status


def close_current_deadline(c: Complaint, met: bool | None) -> None:
    for d in c.deadlines:
        if d.is_current:
            d.is_current = False
            d.met = met


def set_deadline(db: Session, c: Complaint, due_at: datetime, kind: str, reason: str, actor: User | None) -> None:
    close_current_deadline(c, met=None)
    db.add(Deadline(
        complaint_id=c.id, due_at=due_at, kind=kind, reason=reason,
        set_by_id=actor.id if actor else None, is_current=True,
    ))
    c.due_at = due_at


def change_status(db: Session, c: Complaint, to_status: str, actor: User, note: str | None) -> None:
    if to_status not in ALLOWED_TRANSITIONS.get(c.status, set()):
        raise HTTPException(400, f"Cannot move from '{c.status}' to '{to_status}'")
    allowed = ROLE_TARGETS.get(actor.role)
    if allowed is not None and to_status not in allowed:
        raise HTTPException(403, f"A {actor.role} cannot set status '{to_status}'")
    if actor.role == Role.WORKER:
        a = c.active_assignment
        if not a or a.worker_id != actor.id:
            raise HTTPException(403, "This complaint is not assigned to you")
    if actor.role == Role.CITIZEN and c.citizen_id != actor.id:
        raise HTTPException(403, "Not your complaint")
    if to_status in (Status.ASSIGNED, Status.IN_PROGRESS) and not c.active_assignment:
        raise HTTPException(400, "Assign a field worker first")

    now = utcnow()
    if to_status == Status.RESOLVED:
        c.resolved_at = now
        close_current_deadline(c, met=now <= c.due_at)
    elif to_status == Status.REOPENED:
        c.resolved_at = None
        hours = max(c.department.sla_hours // 2, 24)
        record_transition(db, c, to_status, actor, note)
        set_deadline(db, c, now + timedelta(hours=hours), "extension", "Complaint reopened by citizen", actor)
        system_message(c.id, f"Complaint reopened. New deadline set {hours}h from now.")
        return

    record_transition(db, c, to_status, actor, note)
    system_message(c.id, f"Status changed to {to_status.replace('_', ' ').title()} by {actor.name}.")


def escalate(db: Session, c: Complaint, reason: str, actor: User | None) -> Escalation | None:
    """Raise a complaint one level up the chain, bump priority and set a tighter deadline."""
    if c.escalation_level >= MAX_ESCALATION or c.status not in Status.OPEN:
        return None
    now = utcnow()
    c.escalation_level += 1
    level_name = ESCALATION_LEVELS[c.escalation_level]
    idx = PRIORITIES.index(c.priority) if c.priority in PRIORITIES else 1
    c.priority = PRIORITIES[min(idx + 1, len(PRIORITIES) - 1)]

    # Missed deadline is recorded as such; the next one gets progressively shorter.
    for d in c.deadlines:
        if d.is_current:
            d.is_current = False
            d.met = False if now > d.due_at else None
    new_due = now + timedelta(hours=max(c.department.sla_hours // (c.escalation_level + 1), 12))
    db.add(Deadline(
        complaint_id=c.id, due_at=new_due, kind="escalation",
        reason=f"Escalated to {level_name}", set_by_id=actor.id if actor else None,
    ))
    c.due_at = new_due

    esc = Escalation(
        complaint_id=c.id, level=c.escalation_level, escalated_to=level_name, reason=reason,
        triggered_by="manual" if actor else "system", triggered_by_id=actor.id if actor else None,
    )
    db.add(esc)
    system_message(c.id, f"Escalated to {level_name} (level {c.escalation_level}). Reason: {reason}")
    return esc


def run_auto_escalation(db: Session) -> int:
    """Escalate every open complaint whose current deadline has passed."""
    now = utcnow()
    overdue = (
        db.query(Complaint)
        .filter(Complaint.status.in_(Status.OPEN), Complaint.due_at < now,
                Complaint.escalation_level < MAX_ESCALATION)
        .all()
    )
    count = 0
    for c in overdue:
        hours_late = int((now - c.due_at).total_seconds() // 3600)
        if escalate(db, c, f"Deadline missed by {hours_late}h", None):
            count += 1
    db.commit()
    return count
