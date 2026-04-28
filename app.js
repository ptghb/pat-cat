const MAP = L.map("map", { worldCopyJump: false, minZoom: 2, zoomSnap: 0.25, zoomDelta: 0.5, inertia: true }).setView([20, 0], 2.5);
function addBaseLayerWithFallback() {
  const gaode = L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}&scl=1&scale=1", {
    subdomains: "1234",
    noWrap: false,
    maxZoom: 18,
    keepBuffer: 6,
    attribution: "© 高德地图"
  });
  let loaded = false;
  let errorCount = 0;
  gaode.on("load", () => {
    loaded = true;
    setStatus("已加载中文底图：高德");
  });
  gaode.on("tileerror", () => {
    errorCount++;
    if (!loaded && errorCount > 8) {
      MAP.removeLayer(gaode);
      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap 贡献者"
      }).addTo(MAP);
      setStatus("高德底图不可用，已回退到 OSM");
    }
  });
  gaode.addTo(MAP);
}
addBaseLayerWithFallback();
let ROTATE_RUNNING = false;
let ROTATE_TIMER = null;
let ROTATE_LAST_MS = 0;
let ROTATE_SPEED = parseFloat((typeof localStorage !== "undefined" && localStorage.getItem("ROTATE_SPEED")) || "1");
function rotateTick() {
  if (!ROTATE_RUNNING || ROTATE_SPEED <= 0) return;
  const now = Date.now();
  if (!ROTATE_LAST_MS) ROTATE_LAST_MS = now;
  const dt = (now - ROTATE_LAST_MS) / 1000;
  ROTATE_LAST_MS = now;
  const dLng = -ROTATE_SPEED * dt;
  const z = MAP.getZoom();
  const world = 256 * Math.pow(2, z);
  const dx = (dLng * world) / 360;
  MAP.panBy([dx, 0], { animate: false });
}
function startRotation() {
  if (ROTATE_RUNNING) return;
  ROTATE_RUNNING = true;
  ROTATE_LAST_MS = 0;
  ROTATE_TIMER = setInterval(rotateTick, 33);
  try { setStatus(`自转中：${ROTATE_SPEED}°/s`); } catch {}
}
function stopRotation() {
  ROTATE_RUNNING = false;
  if (ROTATE_TIMER) clearInterval(ROTATE_TIMER);
  ROTATE_TIMER = null;
  try { setStatus("自转已暂停"); } catch {}
}
function addRotateSwitcher() {
  const ctl = L.control({ position: "topright" });
  ctl.onAdd = () => {
    const wrap = L.DomUtil.create("div", "rotate-switch");
    const val = isNaN(ROTATE_SPEED) ? 1 : ROTATE_SPEED;
    wrap.innerHTML = `<label style="font-size:12px;color:#222;display:flex;align-items:center;gap:6px;">自转
      <select id="rotateSpeed">
        <option value="0">暂停</option>
        <option value="0.004167">真实(≈15°/h)</option>
        <option value="0.5">0.5°/s</option>
        <option value="1">1°/s</option>
        <option value="3">3°/s</option>
        <option value="10">10°/s</option>
      </select>
    </label>`;
    const sel = wrap.querySelector("#rotateSpeed");
    if (sel) sel.value = String(val);
    sel.addEventListener("change", (e) => {
      const v = parseFloat(e.target.value);
      ROTATE_SPEED = isNaN(v) ? 0 : v;
      try { localStorage.setItem("ROTATE_SPEED", String(ROTATE_SPEED)); } catch {}
      if (ROTATE_SPEED > 0) startRotation(); else stopRotation();
    });
    L.DomEvent.disableClickPropagation(wrap);
    return wrap;
  };
  ctl.addTo(MAP);
}
addRotateSwitcher();
if (ROTATE_SPEED > 0) startRotation();
function subsolarLongitudeNow() {
  const now = new Date();
  const utc = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  let lon = (12 - utc) * 15;
  lon = ((lon + 540) % 360) - 180;
  return lon;
}
function subsolarLatitudeNow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const doy = Math.floor((now - start) / 86400000) + 1;
  const rad = (2 * Math.PI * (doy - 81)) / 365;
  const decl = 23.44 * Math.sin(rad);
  return decl;
}
function setInitialViewBySun() {
  try {
    const lon = subsolarLongitudeNow();
    const lat = subsolarLatitudeNow();
    const z = MAP.getZoom() || 2.5;
    MAP.setView([lat, lon], z, { animate: false });
    setStatus(`已按太阳正对点定位：${lat.toFixed(1)}°, ${lon.toFixed(1)}°`);
  } catch {}
}
setInitialViewBySun();
function addNightshade() {
  try {
    const container = MAP.getContainer();
    if (!container) return;
    let shade = container.querySelector(".nightshade");
    if (!shade) {
      shade = document.createElement("div");
      shade.className = "nightshade";
      container.appendChild(shade);
    }
    shade.style.position = "absolute";
    shade.style.top = "0";
    shade.style.left = "0";
    shade.style.right = "0";
    shade.style.bottom = "0";
    shade.style.pointerEvents = "none";
    shade.style.zIndex = "450";
    shade.style.background = "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 18%, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.0) 65%, rgba(0,0,0,0.35) 82%, rgba(0,0,0,0.78) 100%)";
  } catch {}
}
addNightshade();
const GEO = {
  "美国": [37.1, -95.7],
  "英国": [52.35, -1.5],
  "苏格兰": [56, -4],
  "威尔士": [52.13, -3.78],
  "法国": [46.2, 2.2],
  "德国": [51.2, 10.4],
  "俄罗斯": [61, 105],
  "泰国": [15.87, 100.99],
  "缅甸": [21.9, 95.96],
  "埃及": [26.8, 30.8],
  "日本": [36.2, 138.25],
  "澳大利亚": [-25.3, 133.8],
  "加拿大": [56.1, -106.3],
  "巴西": [-14.2, -51.9],
  "挪威": [60.5, 8.5],
  "瑞典": [60.1, 18.6],
  "希腊": [39.1, 21.8],
  "塞浦路斯": [35.13, 33.4],
  "新加坡": [1.35, 103.82],
  "乌克兰": [48.4, 31.1],
  "中国": [35.0, 103.8],
  "土耳其": [39, 35],
  "马恩岛": [54.23, -4.55],
  "爱尔兰": [53.35, -7.7],
  "大伊朗": [32.4, 53.7],
  "埃塞俄比亚": [9.1, 40.5],
  "肯尼亚": [0.02, 37.9],
  "荷兰": [52.1, 5.3],
  "意大利": [42.8, 12.5],
  "西班牙": [40.3, -3.7],
  "瑞士": [46.8, 8.2],
  "奥地利": [47.5, 14.5],
  "比利时": [50.5, 4.5],
  "芬兰": [64.5, 26],
  "丹麦": [56, 10],
  "冰岛": [64.9, -19],
  "波兰": [52, 19],
  "捷克": [49.8, 15.5],
  "罗马尼亚": [45.9, 24.9],
  "保加利亚": [42.7, 25.5],
  "塞尔维亚": [44, 21],
  "匈牙利": [47.2, 19.1],
  "葡萄牙": [39.4, -8.2],
  "阿根廷": [-38.4, -63.6],
  "智利": [-35.7, -71.5],
  "墨西哥": [23.6, -102.6],
  "中东": [30, 45],
  "北美洲": [45, -100],
  "南美洲": [-15, -60],
  "亚洲": [35, 100],
  "欧洲": [54, 15],
  "非洲": [5, 20]
};
const ICON_CACHE = {};
const placeKey = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
const DYNAMIC_GEO = {};
const MARKERS = [];
let POS_UPDATE_REQ = null;
let POS_UPDATER_READY = false;
const SPACING_PX = 54;
const RING_STEP_PX = 20;
function latLngWithPixelOffset(latlng, dx, dy) {
  const p = MAP.latLngToLayerPoint(latlng);
  const p2 = L.point(p.x + dx, p.y + dy);
  return MAP.layerPointToLatLng(p2);
}
function scheduleMarkerPositionUpdate() {
  if (POS_UPDATE_REQ) return;
  POS_UPDATE_REQ = setTimeout(() => {
    POS_UPDATE_REQ = null;
    const c = MAP.getCenter();
    MARKERS.forEach(m => {
      const k = Math.round((c.lng - m.base.lng) / 360);
      const base = L.latLng(m.base.lat, m.base.lng + 360 * k);
      m.marker.setLatLng(latLngWithPixelOffset(base, m.dx, m.dy));
    });
  }, 0);
}
function ensureMarkerPositionUpdater() {
  if (POS_UPDATER_READY) return;
  POS_UPDATER_READY = true;
  MAP.on("move", scheduleMarkerPositionUpdate);
  MAP.on("zoom", scheduleMarkerPositionUpdate);
}
function ringOffsets(n) {
  const res = [];
  let placed = 0;
  for (let r = 1; placed < n; r++) {
    const cap = 6 * r;
    const use = Math.min(cap, n - placed);
    for (let j = 0; j < use; j++) {
      const angle = (2 * Math.PI * j) / use;
      const dx = Math.cos(angle) * RING_STEP_PX * r;
      const dy = Math.sin(angle) * RING_STEP_PX * r;
      res.push({ dx, dy, z: r * 10 + j });
    }
    placed += use;
  }
  return res;
}
function divIcon(url) {
  const key = url || "fallback";
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  let html;
  if (url) {
    html = `<div class="cat-icon" style="background-image:url('${url}')"></div>`;
  } else {
    html = `<div class="cat-icon fallback">🐱</div>`;
  }
  const icon = L.divIcon({ html, className: "", iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -20] });
  ICON_CACHE[key] = icon;
  return icon;
}
function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}
function setSyncButtonEnabled(enabled) {
  const btn = document.getElementById("syncBtn");
  if (!btn) return;
  btn.disabled = !enabled;
}
async function fetchBreedsFromBackend() {
  const url = "/api/breeds?limit=5000&offset=0";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error("api_error");
    const j = await r.json();
    return (j && j.items) ? j.items : [];
  } finally {
    clearTimeout(timer);
  }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchBreedsWithReconnect() {
  let attempt = 0;
  while (true) {
    try {
      const items = await fetchBreedsFromBackend();
      if (attempt > 0) {
        setStatus(`重连成功，已获取品种 ${items.length} 条`);
      }
      return items;
    } catch (_) {
      attempt += 1;
      setStatus(`连接中断，5 秒后重试（第 ${attempt} 次）…`);
      await sleep(5000);
    }
  }
}
function splitOrigins(origin) {
  if (!origin) return [];
  return origin
    .split(/[,，、\/]|和|与|及|；|;|\(|\)|（|）/g)
    .map(s => s.trim())
    .filter(Boolean);
}
function toCoords(origin) {
  if (GEO[origin]) return GEO[origin];
  const map = {
    "大不列颠": "英国",
    "大不列顛": "英国",
    "英格兰": "英国",
    "俄罗斯联邦": "俄罗斯",
    "缅甸国": "缅甸",
    "波斯": "大伊朗",
    "伊朗": "大伊朗",
    "苏格兰地区": "苏格兰",
    "威尔士地区": "威尔士",
    "马恩": "马恩岛",
    "北美": "北美洲",
    "欧洲大陆": "欧洲",
    "非洲大陆": "非洲",
    "亚洲大陆": "亚洲"
  };
  const norm = (s) => s
    .replace(/美國/g, "美国")
    .replace(/英國/g, "英国")
    .replace(/法國/g, "法国")
    .replace(/德國/g, "德国")
    .replace(/俄羅斯/g, "俄罗斯")
    .replace(/烏克蘭/g, "乌克兰")
    .replace(/希臘/g, "希腊")
    .replace(/緬甸/g, "缅甸")
    .replace(/馬恩島/g, "马恩岛")
    .replace(/愛爾蘭/g, "爱尔兰")
    .replace(/埃塞俄比亞|衣索比亞/g, "埃塞俄比亚")
    .replace(/肯尼亞/g, "肯尼亚")
    .replace(/義大利/g, "意大利")
    .replace(/奧地利/g, "奥地利")
    .replace(/比利時/g, "比利时")
    .replace(/芬蘭/g, "芬兰")
    .replace(/丹麥/g, "丹麦")
    .replace(/冰島/g, "冰岛")
    .replace(/波蘭/g, "波兰")
    .replace(/羅馬尼亞/g, "罗马尼亚")
    .replace(/保加利亞/g, "保加利亚")
    .replace(/塞爾維亞/g, "塞尔维亚")
    .replace(/中東/g, "中东")
    .replace(/亞洲/g, "亚洲")
    .replace(/歐洲/g, "欧洲");
  const key = norm(map[origin] || origin);
  return GEO[key] || DYNAMIC_GEO[key];
}
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function toLargerThumbUrl(url, sizePx) {
  const u = String(url || "");
  if (!u) return "";
  const size = typeof sizePx === "number" && sizePx > 0 ? Math.round(sizePx) : 360;
  return u.replace(/\/thumb\/(.+?)\/(\d+)px-([^/]+)$/i, (_m, p1, _p2, p3) => `/thumb/${p1}/${size}px-${p3}`);
}
function createPopupHtml(item) {
  const link = item.wiki_url || `https://zh.wikipedia.org/wiki/${encodeURIComponent(item.title)}`;
  const name = escapeHtml(item.title);
  const origin = escapeHtml(item.originDisplay || item.origin_display || item.origin || "");
  const thumb = String(item.thumbnail_url || item.imgSrc || "");
  const large = toLargerThumbUrl(thumb, 360) || "";
  const img = thumb
    ? `<img class="preview" src="${escapeHtml(large || thumb)}" alt="${name}" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.fallback){this.onerror=null;this.src=this.dataset.fallback;}" data-fallback="${escapeHtml(thumb)}" />`
    : "";
  return `<div class="cat-popup">${img}<div class="name">${name}</div><div class="meta">原产地：${origin}</div><a href="${escapeHtml(link)}" target="_blank" rel="noopener">前往维基百科</a></div>`;
}
function clearMarkers() {
  while (MARKERS.length) {
    const m = MARKERS.pop();
    try {
      m.marker.remove();
    } catch {}
  }
}
function toWithCoords(breeds) {
  const withCoords = [];
  (breeds || []).forEach(b => {
    const coordsList = Array.isArray(b.origins_coords) ? b.origins_coords : [];
    if (coordsList.length) {
      coordsList.forEach(oc => {
        if (oc && typeof oc.lat === "number" && typeof oc.lon === "number") {
          withCoords.push({
            title: b.title,
            originDisplay: oc.name || b.origin_display || b.origin || "",
            wiki_url: b.wiki_url || "",
            thumbnail_url: b.thumbnail_url || "",
            coords: [oc.lat, oc.lon]
          });
        }
      });
      return;
    }
    const origins = splitOrigins(b.origin_display || b.origin || "");
    if (origins.length === 0) origins.push(b.origin_display || b.origin || "");
    origins.forEach(o => {
      const coords = toCoords(o);
      if (coords && Array.isArray(coords)) {
        withCoords.push({
          title: b.title,
          originDisplay: o,
          wiki_url: b.wiki_url || "",
          thumbnail_url: b.thumbnail_url || "",
          coords
        });
      }
    });
  });
  return withCoords;
}
function renderMarkers(withCoords) {
  clearMarkers();
  const groups = new Map();
  withCoords.forEach(it => {
    const [lat, lng] = it.coords;
    const k = placeKey(lat, lng);
    if (!groups.has(k)) groups.set(k, { base: L.latLng(lat, lng), items: [] });
    groups.get(k).items.push(it);
  });
  let rendered = 0;
  groups.forEach(group => {
    const n = group.items.length;
    const offsets = ringOffsets(n);
    for (let i = 0; i < n; i++) {
      const it = group.items[i];
      const url = it.thumbnail_url || it.imgSrc || "";
      const { dx, dy, z } = offsets[i];
      const pt = latLngWithPixelOffset(group.base, dx, dy);
      const marker = L.marker(pt, { icon: divIcon(url), zIndexOffset: z }).addTo(MAP);
      marker.bindPopup(createPopupHtml(it));
      MARKERS.push({ marker, base: group.base, dx, dy });
      rendered += 1;
    }
  });
  ensureMarkerPositionUpdater();
  scheduleMarkerPositionUpdate();
  return rendered;
}
async function loadFromDbAndRender() {
  setStatus("加载数据库数据…");
  const breeds = await fetchBreedsWithReconnect();
  if (!breeds || breeds.length === 0) {
    clearMarkers();
    setStatus("数据库暂无数据，点击右下角“同步”从维基同步到 MySQL");
    return;
  }
  setStatus(`已获取品种 ${breeds.length} 条，生成地图点位…`);
  const withCoords = toWithCoords(breeds);
  if (withCoords.length === 0) {
    clearMarkers();
    setStatus("暂无可定位的原产地信息");
    return;
  }
  setStatus(`已生成坐标 ${withCoords.length} 条，渲染猫咪标记…`);
  const rendered = renderMarkers(withCoords);
  setStatus(`已渲染 ${rendered} 个猫咪标记`);
}
async function runSync() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch("/api/sync/run", {
      method: "POST",
      headers: { "Accept": "application/json" },
      signal: ctrl.signal
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw new Error("sync_api_error");
    return j;
  } finally {
    clearTimeout(timer);
  }
}
function setupSyncButton() {
  const btn = document.getElementById("syncBtn");
  if (!btn) return;
  let syncing = false;
  btn.addEventListener("click", async () => {
    if (syncing) return;
    syncing = true;
    setSyncButtonEnabled(false);
    setStatus("同步中：正在从维基抓取并写入数据库…");
    try {
      const res = await runSync();
      if (!res.ok) {
        setStatus(`同步失败：${res.detail || "unknown"}`);
        return;
      }
      const upserted = res.stats && typeof res.stats.upserted === "number" ? res.stats.upserted : null;
      setStatus(`同步完成${upserted !== null ? `：写入 ${upserted} 条` : ""}，正在刷新…`);
      await loadFromDbAndRender();
    } catch (_) {
      setStatus("同步失败：网络或服务异常");
    } finally {
      syncing = false;
      setSyncButtonEnabled(true);
    }
  });
}
setupSyncButton();
loadFromDbAndRender();
