from .categories import CATEGORIES, ESCALATION_LEVELS
from .models import Complaint, Department, Status, User, utcnow


def user_out(u: User | None) -> dict | None:
    if not u:
        return None
    return {
        "id": u.id, "name": u.name, "email": u.email, "phone": u.phone, "role": u.role,
        "department_id": u.department_id,
        "department": u.department.name if u.department else None,
        "created_at": u.created_at,
    }


def department_out(d: Department) -> dict:
    return {
        "id": d.id, "name": d.name, "code": d.code, "description": d.description,
        "sla_hours": d.sla_hours, "color": d.color,
    }


def complaint_summary(c: Complaint) -> dict:
    a = c.active_assignment
    now = utcnow()
    overdue = c.status in Status.OPEN and c.due_at < now
    return {
        "id": c.id,
        "ticket_no": c.ticket_no,
        "title": c.title,
        "category": c.category,
        "category_label": CATEGORIES.get(c.category, {}).get("label", c.category),
        "priority": c.priority,
        "status": c.status,
        "address": c.address,
        "ward": c.ward,
        "latitude": c.latitude,
        "longitude": c.longitude,
        "department": department_out(c.department),
        "citizen": {"id": c.citizen.id, "name": c.citizen.name},
        "assignee": {"id": a.worker.id, "name": a.worker.name} if a else None,
        "escalation_level": c.escalation_level,
        "escalated_to": ESCALATION_LEVELS.get(c.escalation_level),
        "due_at": c.due_at,
        "sla_due_at": c.sla_due_at,
        "overdue": overdue,
        "resolved_at": c.resolved_at,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


def complaint_detail(c: Complaint) -> dict:
    data = complaint_summary(c)
    data["description"] = c.description
    data["assignments"] = [
        {"id": a.id, "worker": user_out(a.worker), "assigned_by": a.assigned_by.name,
         "notes": a.notes, "is_active": a.is_active, "assigned_at": a.assigned_at}
        for a in c.assignments
    ]
    data["transitions"] = [
        {"id": t.id, "from_status": t.from_status, "to_status": t.to_status, "note": t.note,
         "changed_by": t.changed_by.name if t.changed_by else "System", "created_at": t.created_at}
        for t in c.transitions
    ]
    data["deadlines"] = [
        {"id": d.id, "due_at": d.due_at, "kind": d.kind, "reason": d.reason, "is_current": d.is_current,
         "met": d.met, "set_by": d.set_by.name if d.set_by else "System", "created_at": d.created_at}
        for d in c.deadlines
    ]
    data["escalations"] = [
        {"id": e.id, "level": e.level, "escalated_to": e.escalated_to, "reason": e.reason,
         "triggered_by": e.triggered_by, "created_at": e.created_at}
        for e in c.escalations
    ]
    return data
