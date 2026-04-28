import json
from datetime import datetime
from typing import Any, Optional

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.orm import Session

from .models import Breed, Origin, SyncState
from .wiki_sync import build_breed_rows, fetch_origin_coords


SYNC_NAME = "wikipedia_cat_breeds"


def get_or_create_state(db: Session) -> SyncState:
    state = db.execute(select(SyncState).where(SyncState.name == SYNC_NAME)).scalar_one_or_none()
    if state:
        return state
    state = SyncState(name=SYNC_NAME, last_success_at=None, last_error="")
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def count_breeds(db: Session) -> int:
    return int(db.execute(select(func.count()).select_from(Breed)).scalar_one())


async def run_sync(db: Session) -> tuple[bool, str, dict[str, Any]]:
    state = get_or_create_state(db)
    try:
        rows, stats = await build_breed_rows()
        if not rows:
            state.last_error = "no_rows"
            state.updated_at = datetime.utcnow()
            db.add(state)
            db.commit()
            return False, "no_rows", stats

        origin_names: set[str] = set()
        for r in rows:
            try:
                origins = json.loads(r.get("origins_json") or "[]")
                if isinstance(origins, list):
                    for o in origins:
                        if isinstance(o, str) and o.strip():
                            origin_names.add(o.strip())
            except Exception:
                pass
        origin_rows = []
        if origin_names:
            async with httpx.AsyncClient(headers={"User-Agent": "pat-cat/1.0"}) as client:
                coords = await fetch_origin_coords(client, sorted(origin_names))
            now = datetime.utcnow()
            for name, (lat, lon) in coords.items():
                origin_rows.append({"name": name, "lat": lat, "lon": lon, "updated_at": now})
            if origin_rows:
                ostmt = mysql_insert(Origin).values(origin_rows)
                ostmt = ostmt.on_duplicate_key_update(
                    lat=ostmt.inserted.lat,
                    lon=ostmt.inserted.lon,
                    updated_at=ostmt.inserted.updated_at,
                )
                db.execute(ostmt)

        stmt = mysql_insert(Breed).values(rows)
        update_cols = {
            "origin_display": stmt.inserted.origin_display,
            "origins_json": stmt.inserted.origins_json,
            "thumbnail_url": stmt.inserted.thumbnail_url,
            "wiki_url": stmt.inserted.wiki_url,
            "updated_at": stmt.inserted.updated_at,
        }
        stmt = stmt.on_duplicate_key_update(**update_cols)
        db.execute(stmt)

        stored_titles = {r["title"] for r in rows}
        to_delete = db.execute(select(Breed.id, Breed.title)).all()
        delete_ids = [bid for bid, title in to_delete if title not in stored_titles]
        if delete_ids:
            db.execute(delete(Breed).where(Breed.id.in_(delete_ids)))

        state.last_success_at = datetime.utcnow()
        state.last_error = ""
        state.updated_at = datetime.utcnow()
        db.add(state)
        db.commit()

        return True, "ok", {**stats, "upserted": len(rows), "deleted": len(delete_ids), "origins": len(origin_rows)}
    except Exception as e:
        msg = str(e).strip()
        if not msg:
            msg = type(e).__name__
        else:
            msg = f"{type(e).__name__}: {msg}"
        state.last_error = msg
        state.updated_at = datetime.utcnow()
        db.add(state)
        db.commit()
        return False, "error", {"error": msg}


def breed_to_out(b: Breed, origin_map: Optional[dict[str, tuple[float, float]]] = None) -> dict[str, Any]:
    try:
        origins = json.loads(b.origins_json or "[]")
        if not isinstance(origins, list):
            origins = []
        origins = [str(x) for x in origins]
    except Exception:
        origins = []
    coords_out = []
    if origin_map and origins:
        for o in origins:
            c = origin_map.get(o)
            if c:
                coords_out.append({"name": o, "lat": c[0], "lon": c[1]})
    return {
        "id": b.id,
        "title": b.title,
        "origin_display": b.origin_display or "",
        "origins": origins,
        "origins_coords": coords_out,
        "thumbnail_url": b.thumbnail_url or "",
        "wiki_url": b.wiki_url or "",
        "updated_at": b.updated_at,
    }
