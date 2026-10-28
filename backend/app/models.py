"""PostgreSQL holds the relational core: users, departments, complaints,
assignments, deadlines, status transitions and escalations."""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role:
    CITIZEN = "citizen"
    WORKER = "worker"
    OFFICIAL = "official"
    ADMIN = "admin"


class Status:
    SUBMITTED = "submitted"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REOPENED = "reopened"
    REJECTED = "rejected"

    OPEN = (SUBMITTED, ASSIGNED, IN_PROGRESS, ON_HOLD, REOPENED)
    DONE = (RESOLVED, CLOSED)


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    sla_hours: Mapped[int] = mapped_column(Integer, default=72)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="department")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=Role.CITIZEN, index=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    department: Mapped[Department | None] = relationship(back_populates="users")


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_no: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40), index=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default=Status.SUBMITTED, index=True)
    address: Mapped[str] = mapped_column(String(300))
    ward: Mapped[str | None] = mapped_column(String(60))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    citizen_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), index=True)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    sla_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    citizen: Mapped[User] = relationship(foreign_keys=[citizen_id])
    department: Mapped[Department] = relationship()
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="complaint", order_by="Assignment.assigned_at.desc()", cascade="all, delete-orphan"
    )
    transitions: Mapped[list["StatusTransition"]] = relationship(
        back_populates="complaint", order_by="StatusTransition.created_at", cascade="all, delete-orphan"
    )
    deadlines: Mapped[list["Deadline"]] = relationship(
        back_populates="complaint", order_by="Deadline.created_at", cascade="all, delete-orphan"
    )
    escalations: Mapped[list["Escalation"]] = relationship(
        back_populates="complaint", order_by="Escalation.created_at", cascade="all, delete-orphan"
    )

    @property
    def active_assignment(self) -> "Assignment | None":
        return next((a for a in self.assignments if a.is_active), None)


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assigned_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    complaint: Mapped[Complaint] = relationship(back_populates="assignments")
    worker: Mapped[User] = relationship(foreign_keys=[worker_id])
    assigned_by: Mapped[User] = relationship(foreign_keys=[assigned_by_id])


class Deadline(Base):
    __tablename__ = "deadlines"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(String(20), default="sla")  # sla | extension | escalation
    reason: Mapped[str | None] = mapped_column(Text)
    set_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    met: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    complaint: Mapped[Complaint] = relationship(back_populates="deadlines")
    set_by: Mapped[User | None] = relationship()


class StatusTransition(Base):
    __tablename__ = "status_transitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    complaint: Mapped[Complaint] = relationship(back_populates="transitions")
    changed_by: Mapped[User | None] = relationship()


class Escalation(Base):
    __tablename__ = "escalations"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    level: Mapped[int] = mapped_column(Integer)
    escalated_to: Mapped[str] = mapped_column(String(120))
    reason: Mapped[str] = mapped_column(Text)
    triggered_by: Mapped[str] = mapped_column(String(20), default="system")  # system | manual
    triggered_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    complaint: Mapped[Complaint] = relationship(back_populates="escalations")
