"""Reset both databases and load demo data.  Run:  python seed.py"""
import random
from datetime import timedelta

from app import mongo
from app.auth import hash_password
from app.categories import CATEGORIES, MAX_ESCALATION
from app.database import Base, SessionLocal, engine
from app.models import (Assignment, Complaint, Deadline, Department, Role, Status, StatusTransition, User,
                        utcnow)
from app.services.workflow import escalate

random.seed(42)

DEPARTMENTS = [
    # code, name, sla_hours, color, efficiency (drives demo resolution quality)
    ("ROADS", "Roads & Infrastructure", 72, "#f97316", 0.55),
    ("ELEC", "Street Lighting & Electrical", 48, "#eab308", 0.85),
    ("WATER", "Water Supply", 24, "#0ea5e9", 0.7),
    ("SANI", "Sanitation & Drainage", 48, "#22c55e", 0.65),
    ("GEN", "General Administration", 96, "#64748b", 0.8),
]

WARDS = ["Ward 1 - Vishrambag", "Ward 2 - Gaonbhag", "Ward 3 - Vijaynagar", "Ward 4 - Madhavnagar",
         "Ward 5 - Kupwad", "Ward 6 - Miraj Road"]
STREETS = ["Station Road", "College Corner", "Market Yard", "Ram Mandir Lane", "Shivaji Chowk",
           "Gandhi Nagar", "Hirabaug Circle", "Laxmi Mandir Road", "Old Pune Highway", "Zulelal Chowk"]

TITLES = {
    "pothole": ["Deep pothole near bus stop", "Series of potholes on main road", "Pothole causing two-wheeler skids",
                "Road caved in after rain"],
    "streetlight": ["Streetlight not working for a week", "Flickering lights on the lane",
                    "Lights stay on during daytime", "Leaning damaged pole"],
    "water_leak": ["Pipeline burst flooding the street", "Continuous leak from public tap",
                   "Water meter leaking", "Contaminated water supply"],
    "garbage": ["Garbage not collected for days", "Debris dumped on footpath", "Overflowing community bin"],
    "drainage": ["Open manhole on busy road", "Sewer overflowing into homes", "Blocked drain causing waterlogging"],
    "other": ["Stray cattle blocking traffic", "Illegal hoarding obstructing view", "Broken bench in park"],
}

COMMENTS_CITIZEN = ["Any update on this?", "This is getting worse every day.", "Thank you for the quick response!",
                    "Please prioritise, children walk this route to school."]
COMMENTS_STAFF = ["Team will visit the site today.", "Material has been requested from the store.",
                  "Work completed, please verify.", "Site inspected, repair scheduled."]


def random_details(category: str) -> dict:
    out = {}
    for f in CATEGORIES[category]["fields"]:
        if f["type"] == "select":
            out[f["name"]] = random.choice(f["options"])
        elif f["type"] == "checkbox":
            out[f["name"]] = random.random() < 0.3
        elif f["type"] == "number":
            out[f["name"]] = random.randint(1, 8)
        else:
            out[f["name"]] = f"SL-{random.randint(100, 999)}" if f["name"] == "pole_number" else "See description"
    return out


def main():
    print("Resetting PostgreSQL schema and MongoDB collections...")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    for col in (mongo.report_details, mongo.inspection_notes, mongo.discussions, mongo.photos):
        col.delete_many({})
    mongo.ensure_indexes()

    db = SessionLocal()
    now = utcnow()

    depts, efficiency = {}, {}
    for code, name, sla, color, eff in DEPARTMENTS:
        d = Department(code=code, name=name, sla_hours=sla, color=color,
                       description=f"Handles {name.lower()} complaints across the city.")
        db.add(d)
        depts[code], efficiency[code] = d, eff
    db.flush()

    db.add(User(name="City Admin", email="admin@civicfix.in", password_hash=hash_password("admin123"),
                role=Role.ADMIN))
    officials, workers = {}, {}
    worker_names = iter(["Ravi Patil", "Sunil Jadhav", "Anita Kale", "Mahesh Shinde", "Pooja More",
                         "Ganesh Pawar", "Kiran Desai", "Sachin Mane", "Rekha Kulkarni", "Ajay Chavan"])
    for code, d in depts.items():
        officials[code] = User(name=f"{d.name.split()[0]} Officer", email=f"{code.lower()}@civicfix.in",
                               password_hash=hash_password("official123"), role=Role.OFFICIAL,
                               department_id=d.id)
        db.add(officials[code])
        workers[code] = []
        for i in range(2):
            w = User(name=next(worker_names), email=f"{code.lower()}.worker{i + 1}@civicfix.in",
                     password_hash=hash_password("worker123"), role=Role.WORKER, department_id=d.id)
            db.add(w)
            workers[code].append(w)

    citizens = [User(name=n, email=e, password_hash=hash_password("citizen123"), role=Role.CITIZEN,
                     phone=f"98{random.randint(10000000, 99999999)}")
                for n, e in [("Amey Kulkarni", "citizen@civicfix.in"), ("Priya Deshmukh", "priya@example.com"),
                             ("Rahul Joshi", "rahul@example.com"), ("Sneha Patwardhan", "sneha@example.com")]]
    db.add_all(citizens)
    db.flush()

    mongo_details, mongo_msgs, mongo_notes = [], [], []

    for n in range(70):
        category = random.choices(list(CATEGORIES), weights=[25, 18, 18, 15, 14, 10])[0]
        code = CATEGORIES[category]["department"]
        dept, eff = depts[code], efficiency[code]
        citizen = random.choice(citizens)
        created = now - timedelta(days=random.uniform(0.2, 45), hours=random.uniform(0, 23))
        sla_due = created + timedelta(hours=dept.sla_hours)

        c = Complaint(
            title=random.choice(TITLES[category]),
            description="Reported by a resident. The issue is affecting daily commute and safety in the area. "
                        "Requesting the concerned department to take action at the earliest.",
            category=category, priority=random.choices(["low", "medium", "high", "critical"], [2, 5, 3, 1])[0],
            address=f"{random.randint(1, 250)}, {random.choice(STREETS)}, Sangli", ward=random.choice(WARDS),
            latitude=16.85 + random.uniform(-0.03, 0.03), longitude=74.58 + random.uniform(-0.03, 0.03),
            citizen_id=citizen.id, department_id=dept.id, sla_due_at=sla_due, due_at=sla_due,
            created_at=created, updated_at=created,
        )
        db.add(c)
        db.flush()
        c.ticket_no = f"CF-{created.year}-{c.id:05d}"

        def transition(frm, to, at, by, note=None):
            db.add(StatusTransition(complaint_id=c.id, from_status=frm, to_status=to, changed_by_id=by.id,
                                    note=note, created_at=at))
            c.status, c.updated_at = to, at

        transition(None, Status.SUBMITTED, created, citizen, "Complaint submitted")
        deadline = Deadline(complaint_id=c.id, due_at=sla_due, kind="sla",
                            reason=f"{dept.name} SLA: {dept.sla_hours}h", created_at=created)
        db.add(deadline)

        # Decide the story of this complaint
        speed = random.uniform(0.25, 1.0) / eff  # fraction of SLA consumed; efficient departments are faster
        assigned_at = created + timedelta(hours=random.uniform(0.5, 6))
        resolved_at = created + timedelta(hours=dept.sla_hours * speed)
        if random.random() < 0.05:
            transition(Status.SUBMITTED, Status.REJECTED, assigned_at, officials[code], "Duplicate complaint")
            deadline.is_current = False
            continue
        if assigned_at > now:
            continue

        worker = random.choice(workers[code])
        db.add(Assignment(complaint_id=c.id, worker_id=worker.id, assigned_by_id=officials[code].id,
                          assigned_at=assigned_at, notes="Please inspect and resolve."))
        transition(Status.SUBMITTED, Status.ASSIGNED, assigned_at, officials[code], f"Assigned to {worker.name}")

        started_at = assigned_at + timedelta(hours=random.uniform(1, 12))
        if started_at > now:
            continue
        transition(Status.ASSIGNED, Status.IN_PROGRESS, started_at, worker)
        mongo_notes.append({
            "complaint_id": c.id, "inspector_id": worker.id, "inspector_name": worker.name,
            "note": random.choice(["Site inspected. Repair requires materials.", "Damage verified on site.",
                                   "Area cordoned off for safety; work begins shortly."]),
            "severity": random.choice(["low", "medium", "high"]), "findings": {},
            "estimated_hours": random.choice([2, 4, 6, 8, 12]), "created_at": started_at,
        })

        if resolved_at < now and random.random() < 0.6 + eff * 0.4:
            resolved_at = max(resolved_at, started_at + timedelta(hours=1))
            if resolved_at < now:
                transition(Status.IN_PROGRESS, Status.RESOLVED, resolved_at, worker, "Work completed")
                c.resolved_at = resolved_at
                deadline.is_current, deadline.met = False, resolved_at <= sla_due
                if random.random() < 0.6:
                    transition(Status.RESOLVED, Status.CLOSED, resolved_at + timedelta(hours=6), citizen,
                               "Verified by citizen")
        elif random.random() < 0.2:
            transition(Status.IN_PROGRESS, Status.ON_HOLD, started_at + timedelta(hours=3), worker,
                       "Waiting for materials")

        mongo_msgs.append({"complaint_id": c.id, "author_id": citizen.id, "author_name": citizen.name,
                           "author_role": "citizen", "message": random.choice(COMMENTS_CITIZEN),
                           "is_internal": False, "system": False, "created_at": started_at})
        mongo_msgs.append({"complaint_id": c.id, "author_id": worker.id, "author_name": worker.name,
                           "author_role": "worker", "message": random.choice(COMMENTS_STAFF),
                           "is_internal": False, "system": False,
                           "created_at": started_at + timedelta(minutes=40)})

    db.commit()
    for c in db.query(Complaint).all():
        mongo_details.append({"complaint_id": c.id, "category": c.category,
                              "fields": random_details(c.category), "created_at": c.created_at})
        mongo_msgs.append({"complaint_id": c.id, "author_id": None, "author_name": "CivicFix",
                           "author_role": "system", "is_internal": False, "system": True,
                           "message": f"Complaint received and routed to {c.department.name}.",
                           "created_at": c.created_at})
    mongo.report_details.insert_many(mongo_details)
    mongo.discussions.insert_many(mongo_msgs)
    if mongo_notes:
        mongo.inspection_notes.insert_many(mongo_notes)

    # Long-overdue complaints climb further up the escalation chain.
    escalated = 0
    overdue = db.query(Complaint).filter(Complaint.status.in_(Status.OPEN), Complaint.due_at < now).all()
    for c in overdue:
        hours_late = (now - c.due_at).total_seconds() / 3600
        levels = min(MAX_ESCALATION, 1 + int(hours_late // c.department.sla_hours))
        for _ in range(levels):
            escalate(db, c, f"Deadline missed by {int(hours_late)}h", None)
        escalated += 1
    db.commit()
    db.close()
    print(f"Seeded {len(mongo_details)} complaints, auto-escalated {escalated} overdue ones.\n")
    print("Demo logins:")
    print("  Admin     admin@civicfix.in        / admin123")
    print("  Official  roads@civicfix.in        / official123   (also elec, water, sani, gen)")
    print("  Worker    roads.worker1@civicfix.in / worker123")
    print("  Citizen   citizen@civicfix.in      / citizen123")


if __name__ == "__main__":
    main()
