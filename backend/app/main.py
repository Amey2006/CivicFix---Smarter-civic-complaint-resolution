import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from . import models  # noqa: F401  (registers tables)
from .config import settings
from .database import Base, SessionLocal, engine
from .mongo import ensure_indexes
from .routers import analytics, auth, complaints, meta
from .services.workflow import run_auto_escalation

log = logging.getLogger("civicfix")


def escalate_once() -> int:
    with SessionLocal() as db:
        return run_auto_escalation(db)


async def escalation_loop():
    while True:
        try:
            n = await run_in_threadpool(escalate_once)
            if n:
                log.info("Auto-escalated %d overdue complaints", n)
        except Exception:
            log.exception("Escalation sweep failed")
        await asyncio.sleep(settings.ESCALATION_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    ensure_indexes()
    task = asyncio.create_task(escalation_loop())
    yield
    task.cancel()


app = FastAPI(title="CivicFix API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

for r in (auth.router, meta.router, complaints.router, analytics.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
