from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from .models import Breed, Origin
from .schemas import BreedListOut, SyncRunOut, SyncStatusOut
from .sync_service import breed_to_out, count_breeds, get_or_create_state, run_sync


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    return {"ok": True, "breeds": count_breeds(db)}


@app.get("/api/breeds", response_model=BreedListOut)
def list_breeds(limit: int = 500, offset: int = 0, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 5000))
    offset = max(0, offset)
    total = count_breeds(db)
    rows = db.execute(select(Breed).order_by(Breed.title.asc()).limit(limit).offset(offset)).scalars().all()
    origin_rows = db.execute(select(Origin)).scalars().all()
    origin_map = {o.name: (o.lat, o.lon) for o in origin_rows}
    return {"total": total, "items": [breed_to_out(b, origin_map=origin_map) for b in rows]}


@app.get("/api/sync/status", response_model=SyncStatusOut)
def sync_status(db: Session = Depends(get_db)):
    state = get_or_create_state(db)
    return {
        "name": state.name,
        "last_success_at": state.last_success_at,
        "last_error": state.last_error or "",
        "updated_at": state.updated_at,
    }


@app.post("/api/sync/run", response_model=SyncRunOut)
async def sync_run(db: Session = Depends(get_db)):
    ok, detail, stats = await run_sync(db)
    return {"ok": ok, "detail": detail, "stats": stats}


REPO_ROOT = Path(__file__).resolve().parents[2]
INDEX = REPO_ROOT / "index.html"


@app.get("/")
def index():
    return FileResponse(INDEX)


app.mount("/", StaticFiles(directory=REPO_ROOT, html=True), name="static")
