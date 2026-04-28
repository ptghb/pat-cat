from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class OriginCoord(BaseModel):
    name: str
    lat: float
    lon: float


class BreedOut(BaseModel):
    id: int
    title: str
    origin_display: str = ""
    origins: list[str] = Field(default_factory=list)
    origins_coords: list[OriginCoord] = Field(default_factory=list)
    thumbnail_url: str = ""
    wiki_url: str = ""
    updated_at: datetime


class BreedListOut(BaseModel):
    total: int
    items: list[BreedOut]


class SyncStatusOut(BaseModel):
    name: str
    last_success_at: Optional[datetime]
    last_error: str = ""
    updated_at: datetime


class SyncRunOut(BaseModel):
    ok: bool
    detail: str = ""
    stats: dict[str, Any] = Field(default_factory=dict)
