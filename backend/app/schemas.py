from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=6, max_length=72)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class StaffIn(RegisterIn):
    role: str
    department_id: int | None = None


class DepartmentIn(BaseModel):
    name: str
    code: str
    description: str | None = None
    sla_hours: int = 72
    color: str = "#6366f1"


class ComplaintIn(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=10)
    category: str
    priority: str = "medium"
    address: str = Field(min_length=3)
    ward: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    details: dict[str, Any] = {}


class AssignIn(BaseModel):
    worker_id: int
    notes: str | None = None


class StatusIn(BaseModel):
    status: str
    note: str | None = None


class DeadlineIn(BaseModel):
    due_at: datetime
    reason: str = Field(min_length=3)


class EscalateIn(BaseModel):
    reason: str = Field(min_length=3)


class CommentIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    is_internal: bool = False


class InspectionIn(BaseModel):
    note: str = Field(min_length=3)
    severity: str = "medium"
    findings: dict[str, Any] = {}
    estimated_hours: float | None = None
