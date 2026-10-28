"""MongoDB stores flexible, document-shaped data: issue-specific report fields,
inspection notes, discussion threads and photo metadata."""
from pymongo import ASCENDING, MongoClient

from .config import settings

client = MongoClient(settings.MONGO_URL, serverSelectionTimeoutMS=5000, tz_aware=True)
mdb = client[settings.MONGO_DB]

report_details = mdb["report_details"]
inspection_notes = mdb["inspection_notes"]
discussions = mdb["discussions"]
photos = mdb["photos"]


def ensure_indexes() -> None:
    report_details.create_index([("complaint_id", ASCENDING)], unique=True)
    inspection_notes.create_index([("complaint_id", ASCENDING), ("created_at", ASCENDING)])
    discussions.create_index([("complaint_id", ASCENDING), ("created_at", ASCENDING)])
    photos.create_index([("complaint_id", ASCENDING)])


def serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc
