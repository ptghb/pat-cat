import json
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup


WIKI_API = "https://zh.wikipedia.org/w/api.php"
LIST_TITLES = ["家猫品种列表", "家貓品種列表"]


def _split_origins(origin_display: str) -> list[str]:
    if not origin_display:
        return []
    parts = []
    buf = origin_display
    for sep in [",", "，", "、", "/", "；", ";", "（", "）", "(", ")", "和", "与", "及"]:
        buf = buf.replace(sep, "|")
    for p in buf.split("|"):
        s = p.strip()
        if s:
            parts.append(s)
    seen = set()
    out: list[str] = []
    for p in parts:
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
    return out


async def fetch_list_html(client: httpx.AsyncClient) -> str:
    for title in LIST_TITLES:
        params = {
            "action": "parse",
            "page": title,
            "prop": "text",
            "format": "json",
            "origin": "*",
            "redirects": "1",
            "variant": "zh-hans",
        }
        r = await client.get(WIKI_API, params=params, timeout=30)
        r.raise_for_status()
        j = r.json()
        html = (j.get("parse") or {}).get("text", {}).get("*") or ""
        if html:
            return html
    return ""


def parse_breeds_from_html(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    tables = soup.select("table.wikitable")
    items: list[dict[str, Any]] = []
    for tbl in tables:
        headers = [th.get_text(strip=True) for th in tbl.select("tr th")]
        origin_idx = -1
        for i, h in enumerate(headers):
            if "原产地" in h or "原產地" in h or "产地" in h or "Origin" in h:
                origin_idx = i
                break
        if origin_idx < 0:
            origin_idx = 1
        rows = tbl.select("tr")[1:]
        for tr in rows:
            tds = tr.select("td,th")
            if len(tds) < 2:
                continue
            name_cell = tds[0]
            origin_cell = tds[origin_idx] if origin_idx < len(tds) else None
            a = name_cell.select_one("a[title]")
            title = (a.get("title") if a else name_cell.get_text(strip=True)).strip()
            if not title:
                continue
            origin_display = ""
            if origin_cell is not None:
                links = [x.get("title") for x in origin_cell.select("a[title]") if x.get("title")]
                origin_display = "、".join(links) if links else origin_cell.get_text(" ", strip=True)
            img = tr.select_one("img")
            img_src = img.get("src") if img else ""
            if img_src.startswith("//"):
                img_src = "https:" + img_src
            items.append(
                {
                    "title": title,
                    "origin_display": origin_display or "",
                    "origins": _split_origins(origin_display or ""),
                    "img_src": img_src or "",
                }
            )
    return items


async def fetch_page_images(client: httpx.AsyncClient, titles: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    batch_size = 50
    for i in range(0, len(titles), batch_size):
        batch = titles[i : i + batch_size]
        params = {
            "action": "query",
            "prop": "pageimages",
            "format": "json",
            "piprop": "thumbnail",
            "pithumbsize": "160",
            "titles": "|".join(batch),
            "origin": "*",
        }
        r = await client.get(WIKI_API, params=params, timeout=30)
        r.raise_for_status()
        j = r.json()
        pages = (j.get("query") or {}).get("pages") or {}
        for p in pages.values():
            title = p.get("title")
            if not title:
                continue
            thumb = (p.get("thumbnail") or {}).get("source") or ""
            out[title] = thumb
    return out


async def fetch_origin_coords(client: httpx.AsyncClient, origins: list[str]) -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    unique = sorted({o for o in origins if o})
    batch_size = 20
    for i in range(0, len(unique), batch_size):
        batch = unique[i : i + batch_size]
        params = {
            "action": "query",
            "prop": "coordinates",
            "format": "json",
            "coprop": "type|name|dim|country|region",
            "colimit": "1",
            "titles": "|".join(batch),
            "origin": "*",
            "redirects": "1",
            "variant": "zh-hans",
        }
        r = await client.get(WIKI_API, params=params, timeout=30)
        r.raise_for_status()
        j = r.json()
        pages = (j.get("query") or {}).get("pages") or {}
        for p in pages.values():
            title = p.get("title")
            coords = p.get("coordinates") or []
            if not title or not coords:
                continue
            c = coords[0]
            lat = c.get("lat")
            lon = c.get("lon")
            if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
                out[title] = (float(lat), float(lon))
    return out


async def build_breed_rows() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    async with httpx.AsyncClient(headers={"User-Agent": "pat-cat/1.0"}) as client:
        html = await fetch_list_html(client)
        if not html:
            return [], {"error": "empty_wiki_html"}
        breeds = parse_breeds_from_html(html)
        titles = sorted({b["title"] for b in breeds if b.get("title")})
        img_map = await fetch_page_images(client, titles)
        now = datetime.utcnow()
        rows: list[dict[str, Any]] = []
        for b in breeds:
            title = b["title"]
            wiki_url = f"https://zh.wikipedia.org/wiki/{quote(title)}"
            thumb = img_map.get(title) or b.get("img_src") or ""
            rows.append(
                {
                    "title": title,
                    "origin_display": b.get("origin_display") or "",
                    "origins_json": json.dumps(b.get("origins") or [], ensure_ascii=False),
                    "thumbnail_url": thumb,
                    "wiki_url": wiki_url,
                    "updated_at": now,
                }
            )
        return rows, {"parsed": len(breeds), "unique_titles": len(titles)}
