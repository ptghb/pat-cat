from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app


def test_homepage_uses_child_friendly_explore_copy():
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    assert "一起探索世界上的猫咪" in response.text


def test_homepage_uses_refresh_cat_trails_button_copy():
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    assert ("开始猫咪探索" in response.text) or ("探索" in response.text)


def test_nightshade_keeps_clear_edges_with_softer_mid_transition():
    app_js = (ROOT / "app.js").read_text(encoding="utf-8")

    assert "rgba(15,23,42,0.78)" in app_js
    assert "rgba(15,23,42,0.30)" in app_js
    assert "rgba(15,23,42,0.35)" not in app_js


def test_homepage_no_longer_shows_pat_cat_badge():
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    assert "PAT CAT" not in response.text


def test_background_highlight_returns_to_top_left():
    styles = (ROOT / "styles.css").read_text(encoding="utf-8")

    assert "circle at top left" in styles
    assert "circle at 72px 72px" not in styles






def test_zoom_control_buttons_are_horizontal():
    styles = (ROOT / "styles.css").read_text(encoding="utf-8")

    assert "display: flex;" in styles
    assert "flex-direction: row;" in styles
    assert ".leaflet-control-zoom a + a" in styles
    assert "margin-top: 0;" in styles
    assert "margin-left: 8px;" in styles
