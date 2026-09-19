(function () {
  "use strict";
  const DATA = window.GUIDE_DATA;
  if (!DATA) throw new Error("GUIDE_DATA is missing");

  const EXTRA_CONTENT = window.GUIDE_CONTENT_PLUS || {};
  DATA.attractions.forEach((attraction) => {
    if (EXTRA_CONTENT[attraction.id]) attraction.sections.push(...EXTRA_CONTENT[attraction.id]);
  });

  const SUBITEM_CONTENT = window.GUIDE_SUBITEM_PLUS || {};
  const REAL_IMAGES = window.GUIDE_REAL_IMAGES || { attractions: {}, subitems: {} };
  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));
  const MAP_WIDTH = 1000;
  const MAP_HEIGHT = 800;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const pad = (value) => String(value).padStart(2, "0");
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    return Math.floor(seconds / 60) + ":" + pad(Math.floor(seconds % 60));
  };
  const state = {
    view: "map", previousView: "map", mapLevel: "city", zoom: 1, fitZoom: 1,
    minZoom: .5, maxZoom: 4.8, panX: 0, panY: 0, selectedRegionId: null,
    selectedAttractionId: null, selectedSubitemId: null, galleryIndex: 0,
    openRegions: new Set(["athens", "delphi", "meteora", "patras", "zakynthos", "olympia", "nafplio", "mycenae", "corinth", "santorini"]),
    mapQuery: "", listQuery: "", audioMode: "preloaded", audioSegment: 0, ttsSegment: 0,
    installPrompt: null, drag: null, pointers: new Map(), pinch: null, mapReady: false
  };
  const regionById = Object.fromEntries(DATA.regions.map((region) => [region.id, region]));
  const attractionById = Object.fromEntries(DATA.attractions.map((item) => [item.id, item]));
  const paletteByTheme = {
    acropolis: ["#184b59", "#0f303b", "#dfb96f"], athena: ["#246270", "#173e49", "#d8aa58"],
    museum: ["#355e67", "#203d46", "#e6d8bd"], temple: ["#80523b", "#382f33", "#d9ae67"],
    ruins: ["#74533d", "#39332e", "#d6a85d"], theater: ["#594237", "#2b3034", "#e0b767"],
    delphi: ["#53695e", "#233c40", "#d7a44f"], meteora: ["#4b4b47", "#242d31", "#d6b87e"],
    church: ["#3c6075", "#213b50", "#d5b56f"], castle: ["#5c5147", "#2d3435", "#c69b5b"],
    fortress: ["#52504a", "#283033", "#c39957"], shipwreck: ["#286d7f", "#153f55", "#e0c99e"],
    cave: ["#146b86", "#073b5a", "#68cdd2"], olympia: ["#536b4c", "#293e36", "#d5ae62"],
    corinth: ["#5c6351", "#343a35", "#c9a35b"], red_beach: ["#9e4f3f", "#542d33", "#e9a46f"],
    black_beach: ["#51565a", "#242d35", "#e2cf9f"], white_beach: ["#548f9a", "#274f61", "#f1e7d0"],
    volcano: ["#5e4e49", "#282e33", "#d1a260"], oia: ["#327c94", "#174b67", "#e7d5ae"],
    fira: ["#2f7890", "#193f59", "#ecd9b6"], pyrgos: ["#6c694e", "#353e36", "#d3b06b"],
    stadium: ["#6c654e", "#303c3d", "#e2d0a6"], garden: ["#4a745d", "#274b45", "#d7c67c"],
    square: ["#4b6672", "#293f4d", "#d8c89e"], neoclassical: ["#7d6d57", "#3c4140", "#e5d2ad"],
    arch: ["#806b51", "#413d39", "#dfc793"], canal: ["#397181", "#1d4659", "#c9b78c"],
    hill: ["#4d6e63", "#273f3f", "#e4bf6d"], market: ["#7d5841", "#403632", "#d6a45d"],
    village: ["#4b7180", "#294455", "#e7d3ad"], mycenae: ["#79543f", "#383334", "#cd9f59"]
  };
  const illustrationKind = {
    acropolis: "temple", athena: "temple", museum: "museum", syntagma: "square",
    "roman-agora": "ruins", monastiraki: "village", plaka: "village", philopappos: "hill",
    "neoclassical-trilogy": "square", "national-garden": "garden", "panathenaic-stadium": "stadium",
    "temple-olympian-zeus": "temple", "hadrians-arch": "arch", lycabettus: "hill",
    "delphi-site": "temple", "delphi-museum": "museum", meteora: "meteora",
    "patras-st-andrew": "church", "patras-roman-odeon": "theater", "patras-castle": "castle",
    "shipwreck-beach": "beach", "blue-caves": "cave", "olympia-site": "temple",
    "olympia-museum": "museum", palamidi: "fortress", mycenae: "fortress",
    "ancient-corinth": "temple", "corinth-canal": "canal", oia: "village",
    "santorini-red-beach": "beach", "santorini-black-beach": "beach", "santorini-white-beach": "beach",
    "santorini-volcano": "volcano", fira: "village", pyrgos: "village"
  };
  let artCounter = 0;

  function paletteFor(attraction) {
    const key = String(attraction.theme || "temple").replace(/-/g, "_");
    return paletteByTheme[key] || paletteByTheme[attraction.theme] || paletteByTheme.temple;
  }

  function kindFor(attraction) {
    if (illustrationKind[attraction.id]) return illustrationKind[attraction.id];
    const theme = String(attraction.theme || "");
    if (/beach|shipwreck/.test(theme)) return "beach";
    if (/castle|fortress|mycenae/.test(theme)) return "fortress";
    if (/oia|fira|pyrgos|village|market|square/.test(theme)) return "village";
    if (/church/.test(theme)) return "church";
    if (/cave/.test(theme)) return "cave";
    if (/volcano/.test(theme)) return "volcano";
    return "temple";
  }

  function sceneShapes(attraction, variant, uid) {
    const kind = kindFor(attraction);
    const v = Number(variant || 0);
    const shift = (v - 1) * 50;
    const temple = '<g transform="translate(' + (250 + shift) + ' 275) scale(.86)" fill="#ecd8ad"><rect x="0" y="75" width="360" height="18" rx="3"/><rect x="28" y="0" width="304" height="25" rx="4"/><path d="M0 25h360l-25 44H25Z"/><rect x="60" y="84" width="34" height="112" rx="4"/><rect x="120" y="84" width="34" height="112" rx="4"/><rect x="180" y="84" width="34" height="112" rx="4"/><rect x="240" y="84" width="34" height="112" rx="4"/><rect x="298" y="84" width="20" height="112" rx="4"/><path d="M48 196h294v14H48Z"/></g>';
    const mountains = '<path d="M0 590 220 325l118 125 150-190 250 295 190-145 272 235v155H0Z" fill="rgba(22,57,59,.25)"/>';
    const shapes = {
      temple: mountains + temple,
      museum: '<rect x="170" y="265" width="860" height="410" rx="14" fill="#eadfc5"/><path d="M130 265h940L930 145H270Z" fill="#d1bf9b"/>' + [280,500,650,800].map((x) => '<rect x="' + x + '" y="335" width="52" height="270" rx="7" fill="#f4e8cd"/>').join(""),
      ruins: mountains + '<rect x="260" y="490" width="60" height="180" rx="6" fill="#dfc18d"/><rect x="390" y="550" width="52" height="120" rx="6" fill="#d6b67c"/><rect x="675" y="455" width="62" height="215" rx="6" fill="#e1c590"/><path d="M260 490 560 390l190 72" fill="none" stroke="#ddc18c" stroke-width="18"/>',
      theater: '<path d="M65 690a540 540 0 0 1 1065 0Z" fill="#d1b889"/><path d="M145 690a460 460 0 0 1 905 0Z" fill="#a98565"/>' + [225,340,455,570,685,800,915].map((x, i) => '<path d="M' + x + ' 690a' + (350 + i * 10) + ' ' + (350 + i * 10) + ' 0 0 1 90 0" fill="none" stroke="#e4cca0" stroke-width="14"/>').join("") + '<rect x="430" y="560" width="330" height="130" rx="8" fill="#745c4e"/>',
      meteora: '<path d="M80 760 140 180h140L360 760Z" fill="#6b6250"/><path d="M390 760 455 245h155l75 515Z" fill="#756953"/><path d="M770 760 850 120h155l90 640Z" fill="#665d4e"/><g fill="#f0e6cc"><rect x="112" y="175" width="150" height="45" rx="6"/><rect x="425" y="240" width="185" height="46" rx="6"/><rect x="825" y="115" width="175" height="45" rx="6"/></g>',
      church: '<rect x="190" y="340" width="820" height="340" rx="12" fill="#efe2c4"/><circle cx="600" cy="315" r="150" fill="#dfbc72"/><path d="M600 70v95M552 118h96" stroke="#f0e2bd" stroke-width="17"/><rect x="530" y="452" width="140" height="228" rx="70 70 0 0" fill="#4f8c99"/>',
      castle: '<path d="M80 700V330h160V240h110v90h180V240h110v90h190V230h110v100h100v370Z" fill="#b79a6b"/><path d="M80 410h1040M80 540h1040" stroke="#826f55" stroke-width="18"/><rect x="430" y="470" width="170" height="230" fill="#514d45"/>',
      fortress: '<path d="M80 720V300l170-100 170 100 150-160 180 160 155-115h215v535Z" fill="#a98964"/><path d="M80 390h1040M80 555h1040M330 200v520M700 140v580" stroke="#6e6455" stroke-width="20"/>',
      beach: '<path d="M0 0h360l155 800H0Z" fill="' + paletteFor(attraction)[2] + '"/><path d="M1200 0H830l-80 800h450Z" fill="' + paletteFor(attraction)[0] + '"/><path d="M0 610c280-120 600-80 1200 190H0Z" fill="#357c94"/><path d="M350 800c150-180 390-240 700-180" fill="none" stroke="#f6ead0" stroke-width="42"/>',
      cave: '<path d="M0 0h1200v250c-210 90-330-110-560 15C420 385 180 240 0 350Z" fill="#443d36"/><ellipse cx="610" cy="500" rx="430" ry="250" fill="url(#' + uid + '-cave)"/><path d="M330 410c130-125 410-125 540 0-60 240-480 250-540 0Z" fill="#51bdcb" opacity=".55"/>',
      volcano: '<path d="M0 760 370 300h460l370 460Z" fill="#4c4743"/><path d="M380 300h440l-65 140H445Z" fill="#262e32"/><path d="M600 290c-40-70-24-130 0-195 50 50 65 115 0 195Z" fill="#cab37f"/>',
      village: '<path d="M0 0h430l135 800H0Z" fill="#b17255"/><path d="M1200 0H820l-80 800h460Z" fill="#9f644f"/>' + [360,485,610,735,860].map((x, i) => '<rect x="' + x + '" y="' + (250 + i * 48) + '" width="120" height="130" rx="5" fill="#f3ead7"/>').join("") + '<path d="M520 350c0-62 100-62 100 0Z" fill="#2b7e94"/>',
      stadium: '<ellipse cx="600" cy="480" rx="520" ry="300" fill="#d9c99e"/><ellipse cx="600" cy="480" rx="370" ry="190" fill="#6f775c"/><path d="M170 480c0-205 195-365 430-365s430 160 430 365" fill="none" stroke="#f0e4c5" stroke-width="95"/>',
      garden: '<circle cx="240" cy="310" r="180" fill="#547b58"/><circle cx="460" cy="250" r="210" fill="#64865e"/><circle cx="760" cy="300" r="190" fill="#4f7457"/><circle cx="990" cy="260" r="220" fill="#617f57"/><path d="M0 700c240-130 490-110 760-40 180 45 300 30 440-20v160H0Z" fill="#476e52"/>',
      square: '<rect x="180" y="240" width="840" height="430" rx="12" fill="#e7d8b8"/><path d="M135 240h930L900 120H300Z" fill="#cbb888"/>' + [280,470,660,850].map((x) => '<rect x="' + x + '" y="315" width="55" height="355" rx="7" fill="#f5ead0"/>').join(""),
      arch: '<path d="M230 680V315c0-120 80-205 195-205s195 85 195 205v365H560V320c0-90-57-140-135-140s-135 50-135 140v360Z" fill="#e1c995"/><path d="M215 680h780v42H215Z" fill="#c7a66f"/>',
      canal: '<path d="M0 0h430l95 800H0Z" fill="#9b7d5d"/><path d="M1200 0H770l-95 800h525Z" fill="#8d7255"/><path d="M430 0h340l-95 800H525Z" fill="#2e7992"/><path d="M395 0l115 720M805 0 685 720" stroke="#dcc59a" stroke-width="20"/>',
      hill: mountains + '<path d="M0 760c190-230 370-260 560-105 180-190 380-200 640 105Z" fill="#47604f"/>'
    };
    return shapes[kind] || shapes.temple;
  }

  function illustrationSvg(attraction, variant) {
    const uid = "art" + (++artCounter);
    const palette = paletteFor(attraction);
    return '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + escapeHtml(attraction.name) + ' 离线主题插画 ' + (Number(variant) + 1) + '">' +
      '<defs><linearGradient id="' + uid + '-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + palette[0] + '"/><stop offset="1" stop-color="' + palette[1] + '"/></linearGradient><radialGradient id="' + uid + '-cave"><stop offset="0" stop-color="#67d4dc"/><stop offset="1" stop-color="#0b4b68"/></radialGradient></defs>' +
      '<rect width="1200" height="800" fill="url(#' + uid + '-sky)"/>' +
      '<circle cx="' + (985 - Number(variant || 0) * 55) + '" cy="145" r="75" fill="#f5d995" opacity=".68"/>' +
      '<path d="M0 520c180-90 310-80 470 5 145-100 300-105 470-5 110-75 190-82 260-50v330H0Z" fill="' + palette[2] + '" opacity=".28"/>' +
      sceneShapes(attraction, variant, uid) +
      '<g opacity=".11" fill="none" stroke="#fff" stroke-width="3"><path d="M80 110h1040M80 165h880M80 220h980"/></g></svg>';
  }

  function corePoints(attraction) {
    const subitems = attraction.subitems || [];
    const config = SUBITEM_CONTENT[attraction.id] || {};
    const order = config.route || subitems.map((item) => item.id);
    return order.map((id, index) => ({ ...subitems.find((item) => item.id === id), order: index + 1 })).filter((item) => item && item.id);
  }

  function corePointDetail(attraction, subitem) {
    const config = SUBITEM_CONTENT[attraction.id] || {};
    return (config.details && config.details[subitem.id]) || subitem.summary;
  }

  function realAttractionImage(attractionId) {
    return (REAL_IMAGES.attractions && REAL_IMAGES.attractions[attractionId]) || null;
  }

  function realSubitemImage(attractionId, subitemId) {
    return REAL_IMAGES.subitems && REAL_IMAGES.subitems[attractionId] && REAL_IMAGES.subitems[attractionId][subitemId] || null;
  }

  function mediaMarkup(attraction, subitem, className) {
    const entry = subitem ? realSubitemImage(attraction.id, subitem.id) : realAttractionImage(attraction.id);
    if (entry && entry.localPath) return '<img class="' + (className || "real-photo") + '" src="' + escapeHtml(entry.localPath) + '" alt="' + escapeHtml(subitem ? subitem.name : attraction.name) + '" loading="lazy" decoding="async">';
    return illustrationSvg(attraction, subitem ? subitem.order % 3 : 0);
  }

  function mediaCredit(entry) {
    if (!entry) return "离线主题插画";
    return "图片：" + escapeHtml(entry.title || "Wikimedia Commons") + " · " + escapeHtml(entry.artist || "Commons contributor") + " · " + escapeHtml(entry.license || "Wikimedia Commons") + (entry.fallback ? " · " + escapeHtml(entry.fallbackNote || "同景点参考图") : "");
  }

  function narrationSegments(attraction) {
    const segments = [{ id: "overview", type: "overview", title: "景点概览", text: attraction.summary, audio: "./assets/audio/paragraphs-v2/" + attraction.id + "/overview.wav" }];
    corePoints(attraction).forEach((subitem) => {
      segments.push({
        id: "core-" + subitem.id, type: "core", subitemId: subitem.id,
        title: "第" + subitem.order + "站 · " + subitem.name,
        text: corePointDetail(attraction, subitem),
        audio: "./assets/audio/paragraphs-v2/" + attraction.id + "/core-" + subitem.id + ".wav"
      });
    });
    return segments;
  }
  function project(coords) {
    const bounds = DATA.mapBounds;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    return {
      x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * MAP_WIDTH,
      y: ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * MAP_HEIGHT
    };
  }

  function polygon(points, className) {
    const values = points.map((coords) => {
      const point = project(coords);
      return point.x.toFixed(1) + "," + point.y.toFixed(1);
    }).join(" ");
    return '<polygon class="' + (className || "map-island") + '" points="' + values + '"/>';
  }

  function polyline(points, className) {
    const values = points.map((coords) => {
      const point = project(coords);
      return point.x.toFixed(1) + "," + point.y.toFixed(1);
    }).join(" ");
    return '<polyline class="' + className + '" points="' + values + '"/>';
  }

  function buildMapBase() {
    const mainland = [
      [19.45,39.65],[19.7,40.45],[20.25,41.05],[20.9,41.38],[21.8,41.45],[22.8,41.28],
      [24.05,41.25],[24.55,40.72],[23.72,40.25],[23.8,39.55],[22.95,38.95],[22.62,38.25],
      [22.2,37.9],[21.65,38.0],[21.15,38.48],[20.72,38.9],[20.05,39.25]
    ];
    const peloponnese = [
      [21.05,37.82],[21.4,37.42],[21.72,36.75],[22.15,36.38],[22.65,36.45],[23.15,36.68],
      [23.45,37.1],[23.05,37.65],[22.72,37.95],[22.0,38.18],[21.35,38.15]
    ];
    const crete = [
      [23.45,35.38],[24.05,35.18],[24.75,35.12],[25.55,35.22],[26.2,35.05],[26.55,35.2],
      [26.1,35.52],[25.35,35.62],[24.6,35.55],[23.75,35.65]
    ];
    const evia = [
      [23.05,38.9],[23.45,38.65],[24.25,38.25],[24.6,38.45],[24.2,38.85],[23.65,39.1]
    ];
    const islands = [
      { cx: 19.92, cy: 39.65, rx: 12, ry: 30, rotate: -35 },
      { cx: 20.72, cy: 37.78, rx: 10, ry: 22, rotate: -40 },
      { cx: 20.18, cy: 38.22, rx: 16, ry: 38, rotate: -38 },
      { cx: 20.68, cy: 38.75, rx: 8, ry: 24, rotate: -42 },
      { cx: 25.43, cy: 36.39, rx: 11, ry: 30, rotate: -58 },
      { cx: 25.33, cy: 37.45, rx: 8, ry: 20, rotate: -62 },
      { cx: 25.53, cy: 37.1, rx: 11, ry: 26, rotate: -58 },
      { cx: 26.55, cy: 37.05, rx: 10, ry: 22, rotate: -52 },
      { cx: 27.28, cy: 37.02, rx: 8, ry: 17, rotate: -58 },
      { cx: 27.15, cy: 36.88, rx: 12, ry: 35, rotate: 5 },
      { cx: 26.32, cy: 39.32, rx: 11, ry: 19, rotate: -25 }
    ];
    const grid = [100,200,300,400,500,600,700,800,900].map((x) => '<path d="M' + x + ' 0v800"/>').join("") + [100,200,300,400,500,600,700].map((y) => '<path d="M0 ' + y + 'h1000"/>').join("");
    const route = [
      [23.7275,37.9838],[22.5,38.482],[21.63,39.721],[21.7346,38.246],[20.852,37.787],
      [21.63,37.638],[22.756,37.730],[22.805,37.567],[22.928,37.938],[23.73,37.98]
    ];
    const cam = islands.map((item) => {
      const point = project([item.cx, item.cy]);
      return '<ellipse class="map-island" cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" rx="' + item.rx + '" ry="' + item.ry + '" transform="rotate(' + item.rotate + ' ' + point.x.toFixed(1) + ' ' + point.y.toFixed(1) + ')"/>';
    }).join("");
    const labels = [
      ["爱琴海", [25.35,38.6]], ["爱奥尼亚海", [19.85,38.75]], ["克里特海", [24.55,36.4]],
      ["伯罗奔尼撒", [22.05,37.15]], ["阿提卡", [23.95,38.15]], ["优卑亚岛", [23.85,38.65]]
    ].map((item) => {
      const point = project(item[1]);
      const sea = /海/.test(item[0]);
      return '<text class="' + (sea ? "map-sea-label" : "map-place-label") + '" x="' + point.x + '" y="' + point.y + '" text-anchor="middle">' + item[0] + "</text>";
    }).join("");
    return '<svg viewBox="0 0 1000 800" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#315e58" flood-opacity=".16"/></filter></defs>' +
      '<rect width="1000" height="800" fill="none"/>' +
      '<g class="map-grid">' + grid + "</g>" +
      '<g filter="url(#map-shadow)">' + polygon(mainland, "map-land") + polygon(peloponnese, "map-land") + polygon(crete, "map-island") + polygon(evia, "map-island") + cam + "</g>" +
      polyline(route, "map-route") +
      labels +
      '<path class="map-detail-line" d="M680 190c80 30 160 22 245 70M160 260c-40 55-45 110-28 170"/>' +
    "</svg>";
  }

  function updateMapTransform() {
    const viewport = $("#mapViewport");
    const content = $("#mapContent");
    if (!viewport || !content) return;
    const rect = viewport.getBoundingClientRect();
    const scaledWidth = MAP_WIDTH * state.zoom;
    const scaledHeight = MAP_HEIGHT * state.zoom;
    if (scaledWidth <= rect.width) state.panX = (rect.width - scaledWidth) / 2;
    else state.panX = clamp(state.panX, rect.width - scaledWidth - 90, 90);
    if (scaledHeight <= rect.height) state.panY = (rect.height - scaledHeight) / 2;
    else state.panY = clamp(state.panY, rect.height - scaledHeight - 90, 90);
    content.style.transform = "translate3d(" + state.panX + "px," + state.panY + "px,0) scale(" + state.zoom + ")";
    content.style.setProperty("--inv-scale", 1 / state.zoom);
    $$(".map-marker", content).forEach((marker) => marker.style.setProperty("--inv-scale", 1 / state.zoom));
    const level = state.zoom < Math.max(state.fitZoom * 1.42, .96) ? "city" : state.zoom < Math.max(state.fitZoom * 2.28, 1.75) ? "site" : "detail";
    if (level !== state.mapLevel) {
      state.mapLevel = level;
      renderMapMarkers();
    }
    const labels = { city: "城市聚合", site: "景点层", detail: "子项层" };
    $("#mapLevelLabel").textContent = labels[level] + " · " + Math.round(state.zoom / Math.max(state.fitZoom, .01) * 100) + "%";
  }

  function fitMap() {
    const viewport = $("#mapViewport");
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    state.fitZoom = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT) * .94;
    state.minZoom = state.fitZoom * .82;
    state.zoom = state.fitZoom;
    state.panX = (rect.width - MAP_WIDTH * state.zoom) / 2;
    state.panY = (rect.height - MAP_HEIGHT * state.zoom) / 2;
    state.mapLevel = "city";
    renderMapMarkers();
    updateMapTransform();
  }

  function zoomAt(clientX, clientY, factor) {
    const viewport = $("#mapViewport");
    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const oldZoom = state.zoom;
    const nextZoom = clamp(oldZoom * factor, state.minZoom, state.maxZoom);
    if (Math.abs(nextZoom - oldZoom) < .0001) return;
    const mapX = (localX - state.panX) / oldZoom;
    const mapY = (localY - state.panY) / oldZoom;
    state.zoom = nextZoom;
    state.panX = localX - mapX * nextZoom;
    state.panY = localY - mapY * nextZoom;
    updateMapTransform();
  }

  function focusMapPoint(coords, targetZoom) {
    const viewport = $("#mapViewport");
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const point = project(coords);
    state.zoom = clamp(targetZoom || Math.max(2.0, state.fitZoom * 2.65), state.minZoom, state.maxZoom);
    state.panX = rect.width / 2 - point.x * state.zoom;
    state.panY = rect.height / 2 - point.y * state.zoom;
    updateMapTransform();
  }

  function markerSvg(kind) {
    if (kind === "region") return '<span class="marker-pin"><span class="region-count"></span></span>';
    return '<span class="marker-pin">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.3"/></svg>' + '</span>';
  }

  function renderMapMarkers() {
    const layer = $("#mapMarkers");
    if (!layer || !state.mapReady) return;
    const query = state.mapQuery.trim().toLowerCase();
    const regionCounts = Object.fromEntries(DATA.regions.map((region) => [region.id, 0]));
    DATA.attractions.forEach((item) => { regionCounts[item.regionId] += 1; });
    const level = state.mapLevel;
    const showAllSites = state.zoom >= Math.max(state.fitZoom * 1.75, 1.35);
    const showSubitems = level === "detail" || state.zoom >= 2.65;
    let html = "";

    if (level === "city") {
      html = DATA.regions.map((region) => {
        const point = project(region.center);
        const dimmed = query && !(region.name.toLowerCase().includes(query) || DATA.attractions.some((item) => item.regionId === region.id && searchable(item).includes(query)));
        return '<button class="map-marker" type="button" data-kind="region" data-region="' + region.id + '" style="left:' + (point.x / 10) + '%;top:' + (point.y / 8) + '%;--marker-color:' + region.color + '" aria-label="' + escapeHtml(region.name) + '，' + regionCounts[region.id] + '个景点">' +
          '<span class="marker-pin"><span>' + regionCounts[region.id] + '</span></span><span class="marker-label">' + escapeHtml(region.short) + '</span></button>';
      }).join("");
    } else {
      const visibleAttractions = DATA.attractions.filter((item) => item.tier === 1 || showAllSites || item.id === state.selectedAttractionId);
      html += visibleAttractions.map((item) => {
        const region = regionById[item.regionId];
        const point = project(item.coords);
        const dimmed = query && !searchable(item).includes(query);
        return '<button class="map-marker' + (item.id === state.selectedAttractionId ? " is-selected" : "") + (dimmed ? " is-dimmed" : "") + '" type="button" data-kind="site" data-site="' + item.id + '" style="left:' + (point.x / 10) + '%;top:' + (point.y / 8) + '%;--marker-color:' + region.color + '" aria-label="' + escapeHtml(item.name) + '">' + markerSvg("site") + '<span class="marker-label">' + escapeHtml(item.name) + "</span></button>";
      }).join("");
      if (showSubitems) {
        DATA.attractions.forEach((item) => {
          if (!item.subitems || (!showAllSites && item.id !== state.selectedAttractionId)) return;
          const region = regionById[item.regionId];
          item.subitems.forEach((subitem) => {
            const point = project(subitem.coords);
            const dimmed = query && !(searchable(item) + subitem.name).toLowerCase().includes(query);
            html += '<button class="map-marker' + (subitem.id === state.selectedSubitemId ? " is-selected" : "") + (dimmed ? " is-dimmed" : "") + '" type="button" data-kind="sub" data-site="' + item.id + '" data-sub="' + subitem.id + '" style="left:' + (point.x / 10) + '%;top:' + (point.y / 8) + '%;--marker-color:' + region.color + '" aria-label="' + escapeHtml(subitem.name) + '">' + markerSvg("sub") + '<span class="marker-label">' + escapeHtml(subitem.name) + "</span></button>";
          });
        });
      }
    }
    layer.innerHTML = html;
    $$(".map-marker", layer).forEach((marker) => {
      marker.style.setProperty("--inv-scale", 1 / state.zoom);
      marker.addEventListener("click", (event) => {
        event.stopPropagation();
        if (marker.dataset.region) showRegionPeek(marker.dataset.region);
        else openAttraction(marker.dataset.site, marker.dataset.sub || null);
      });
    });
  }

  function searchable(item) {
    return [item.name, item.latin, item.type, item.summary, (item.tags || []).join(" "), regionById[item.regionId] && regionById[item.regionId].name]
      .join(" ").toLowerCase();
  }
  function bindMapInteractions() {
    const viewport = $("#mapViewport");
    const shell = $("#mapShell");
    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * .0015));
    }, { passive: false });
    viewport.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".map-marker")) return;
      if (event.button !== undefined && event.button > 0) return;
      viewport.setPointerCapture(event.pointerId);
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.classList.add("is-dragging");
      if (state.pointers.size === 1) {
        state.drag = { x: event.clientX, y: event.clientY, startX: state.panX, startY: state.panY, moved: false };
        state.pinch = null;
      } else if (state.pointers.size === 2) {
        const points = Array.from(state.pointers.values());
        state.pinch = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom: state.zoom, centerX: (points[0].x + points[1].x) / 2, centerY: (points[0].y + points[1].y) / 2 };
        state.drag = null;
      }
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!state.pointers.has(event.pointerId)) return;
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.pointers.size === 1 && state.drag) {
        const dx = event.clientX - state.drag.x;
        const dy = event.clientY - state.drag.y;
        if (Math.hypot(dx, dy) > 3) state.drag.moved = true;
        state.panX = state.drag.startX + dx;
        state.panY = state.drag.startY + dy;
        updateMapTransform();
      } else if (state.pointers.size === 2 && state.pinch) {
        const points = Array.from(state.pointers.values());
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const factor = distance / Math.max(state.pinch.distance, 1);
        const targetZoom = clamp(state.pinch.zoom * factor, state.minZoom, state.maxZoom);
        zoomAt(state.pinch.centerX, state.pinch.centerY, targetZoom / state.zoom);
      }
    });
    const endPointer = (event) => {
      state.pointers.delete(event.pointerId);
      if (state.pointers.size === 1) {
        const point = Array.from(state.pointers.values())[0];
        state.drag = { x: point.x, y: point.y, startX: state.panX, startY: state.panY, moved: true };
        state.pinch = null;
      } else if (state.pointers.size === 0) {
        state.drag = null;
        state.pinch = null;
        viewport.classList.remove("is-dragging");
      }
    };
    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);
    viewport.addEventListener("dblclick", (event) => zoomAt(event.clientX, event.clientY, 1.55));
    viewport.addEventListener("keydown", (event) => {
      const center = viewport.getBoundingClientRect();
      if (event.key === "+" || event.key === "=") zoomAt(center.left + center.width / 2, center.top + center.height / 2, 1.18);
      if (event.key === "-") zoomAt(center.left + center.width / 2, center.top + center.height / 2, .84);
      if (event.key === "ArrowLeft") { state.panX += 50; updateMapTransform(); }
      if (event.key === "ArrowRight") { state.panX -= 50; updateMapTransform(); }
      if (event.key === "ArrowUp") { state.panY += 50; updateMapTransform(); }
      if (event.key === "ArrowDown") { state.panY -= 50; updateMapTransform(); }
    });
    $("#zoomIn").addEventListener("click", () => { const r = viewport.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); });
    $("#zoomOut").addEventListener("click", () => { const r = viewport.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, .8); });
    $("#zoomReset").addEventListener("click", () => { hideRegionPeek(); fitMap(); });
    $("#regionPeekClose").addEventListener("click", hideRegionPeek);
    $("#regionPeekFocus").addEventListener("click", () => {
      const region = regionById[state.selectedRegionId];
      if (!region) return;
      focusMapPoint(region.center, Math.max(2.05, state.fitZoom * 2.8));
      hideRegionPeek();
    });
    $("#regionPeekList").addEventListener("click", () => {
      const region = regionById[state.selectedRegionId];
      if (!region) return;
      state.openRegions.add(region.id);
      showView("list");
      requestAnimationFrame(() => document.getElementById("region-" + region.id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
    shell.addEventListener("click", (event) => {
      if (event.target === shell || event.target.classList.contains("map-viewport")) hideRegionPeek();
    });
  }
  function showRegionPeek(regionId) {
    const region = regionById[regionId];
    if (!region) return;
    state.selectedRegionId = regionId;
    $("#regionPeekKicker").textContent = "城市 / 地区";
    $("#regionPeekTitle").textContent = region.name;
    $("#regionPeekText").textContent = region.subtitle + "。" + region.blurb;
    $("#regionPeek").hidden = false;
    $$(".city-chip").forEach((chip) => chip.classList.toggle("is-active", chip.dataset.region === regionId));
  }

  function hideRegionPeek() {
    $("#regionPeek").hidden = true;
    state.selectedRegionId = null;
    $$(".city-chip").forEach((chip) => chip.classList.remove("is-active"));
  }

  function renderCityRibbon() {
    const ribbon = $("#cityRibbon");
    ribbon.innerHTML = DATA.regions.map((region) => {
      const count = DATA.attractions.filter((item) => item.regionId === region.id).length;
      return '<button class="city-chip" type="button" data-region="' + region.id + '" style="--chip-color:' + region.color + '">' + escapeHtml(region.name) + '<small>' + count + "</small></button>";
    }).join("");
    ribbon.addEventListener("click", (event) => {
      const chip = event.target.closest(".city-chip");
      if (!chip) return;
      const region = regionById[chip.dataset.region];
      showRegionPeek(region.id);
      focusMapPoint(region.center, Math.max(2.05, state.fitZoom * 2.8));
    });
  }
  function renderList() {
    const query = state.listQuery.trim().toLowerCase();
    let visibleTotal = 0;
    const groups = DATA.regions.map((region) => {
      const items = DATA.attractions.filter((item) => item.regionId === region.id && (!query || searchable(item).includes(query)));
      visibleTotal += items.length;
      if (!items.length) return "";
      const isOpen = Boolean(query) || state.openRegions.has(region.id);
      const cards = items.map((item) => {
        const tags = (item.tags || []).slice(0, 3).map((tag) => '<span class="tag">' + escapeHtml(tag) + "</span>").join("");
        return '<button class="site-card" type="button" data-site="' + item.id + '">' +
          '<span class="site-thumb">' + mediaMarkup(item, null, "real-photo") + "</span>" +
          '<span class="site-card-copy"><strong>' + escapeHtml(item.name) + "</strong><small>" + escapeHtml(item.type) + '</small><p>' + escapeHtml(item.summary.slice(0, 68)) + "…</p><span class=\"tag-row\">" + tags + "</span></span>" +
          '<span class="site-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span></button>';
      }).join("");
      return '<section class="list-group' + (isOpen ? " is-open" : "") + '" id="region-' + region.id + '" data-region="' + region.id + '" style="--region-color:' + region.color + '">' +
        '<button class="list-group-header" type="button" data-toggle-region="' + region.id + '" aria-expanded="' + isOpen + '">' +
        '<span class="region-monogram">' + escapeHtml(region.short.slice(0, 1)) + "</span>" +
        '<span><h2>' + escapeHtml(region.name) + '</h2><p>' + escapeHtml(region.subtitle) + " · " + items.length + ' 个景点</p></span>' +
        '<span class="group-count">' + items.length + ' 项<svg class="group-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>' +
        '<div class="list-group-content"><div class="list-group-inner"><div class="site-list">' + cards + "</div></div></div></section>";
    }).join("");
    $("#listGroups").innerHTML = groups;
    $("#listEmpty").hidden = visibleTotal > 0;
    $("#statSites").textContent = DATA.attractions.length;
    $("#statCities").textContent = DATA.regions.length;
    $("#statChapters").textContent = DATA.attractions.reduce((sum, item) => sum + item.sections.length + 1, 0);
    renderRegionJump();
  }

  function renderRegionJump() {
    $("#regionJump").innerHTML = DATA.regions.map((region) => '<button type="button" data-jump="' + region.id + '" style="--region-color:' + region.color + '"><span>' + escapeHtml(region.name) + '</span><i></i></button>').join("");
  }

  function bindListInteractions() {
    $("#listSearchInput").addEventListener("input", (event) => { state.listQuery = event.target.value; renderList(); });
    $("#regionJump").addEventListener("click", (event) => {
      const button = event.target.closest("[data-jump]");
      if (!button) return;
      const id = button.dataset.jump;
      state.openRegions.add(id);
      renderList();
      requestAnimationFrame(() => document.getElementById("region-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
    $("#listGroups").addEventListener("click", (event) => {
      const card = event.target.closest("[data-site]");
      const toggle = event.target.closest("[data-toggle-region]");
      if (card) { openAttraction(card.dataset.site); return; }
      if (!toggle) return;
      const id = toggle.dataset.toggleRegion;
      if (state.openRegions.has(id)) state.openRegions.delete(id); else state.openRegions.add(id);
      renderList();
    });
    $("#collapseAllButton").addEventListener("click", () => {
      const shouldCollapse = state.openRegions.size > 0;
      state.openRegions.clear();
      $("#collapseAllButton").textContent = shouldCollapse ? "全部展开" : "收起全部";
      if (!shouldCollapse) DATA.regions.forEach((region) => state.openRegions.add(region.id));
      renderList();
    });
  }
  function renderDetail(attractionId, subitemId) {
    const item = attractionById[attractionId];
    const detailView = $("#detailView");
    if (!item) { detailView.innerHTML = '<div class="empty-state"><h2>未找到该景点</h2></div>'; showView("detail"); return; }
    stopAudio();
    state.selectedAttractionId = item.id;
    state.selectedSubitemId = subitemId || null;
    state.galleryIndex = 0;
    const region = regionById[item.regionId];
    const palette = paletteFor(item);
    const points = corePoints(item);
    const heroEntry = realAttractionImage(item.id);
    const galleryItems = [];
    if (heroEntry) galleryItems.push({ entry: heroEntry, title: item.name, variant: 0 });
    points.forEach((point, index) => {
      const entry = realSubitemImage(item.id, point.id);
      if (entry) galleryItems.push({ entry, title: point.name, subitem: point, variant: index % 3 });
    });
    while (galleryItems.length < 3) galleryItems.push({ entry: null, title: item.name, variant: galleryItems.length });
    const gallery = galleryItems.slice(0, 3).map((media, index) => '<div class="gallery-image' + (index === 0 ? " is-active" : "") + '" data-gallery-image="' + index + '" data-gallery-title="' + escapeHtml(media.title) + '" data-gallery-credit="' + escapeHtml(mediaCredit(media.entry)) + '">' + mediaMarkup(item, media.subitem || null, "real-photo gallery-photo") + '</div>').join("");
    const thumbs = galleryItems.slice(0, 3).map((media, index) => '<button class="gallery-thumb' + (index === 0 ? " is-active" : "") + '" type="button" data-gallery-thumb="' + index + '" aria-label="查看 ' + escapeHtml(media.title) + '">' + mediaMarkup(item, media.subitem || null, "real-photo") + "</button>").join("");
    const pointCards = points.map((point) => {
      const detail = corePointDetail(item, point);
      const image = realSubitemImage(item.id, point.id);
      const prev = points[point.order - 2];
      const next = points[point.order];
      const routeText = [prev ? "上一站 " + prev.name : "路线起点", next ? "下一站 " + next.name : "路线终点"].join(" · ");
      return '<article class="core-stop" id="core-' + point.id + '" data-core-point="' + point.id + '">' +
        '<figure class="core-stop-media">' + mediaMarkup(item, point, "real-photo") + '<figcaption>' + mediaCredit(image) + '</figcaption></figure>' +
        '<div class="core-stop-content">' +
          '<div class="core-stop-heading">' +
            '<span class="stop-order">' + pad(point.order) + '</span>' +
            '<div class="core-stop-title"><small>核心游览点 ' + point.order + " / " + points.length + '</small><h3>' + escapeHtml(point.name) + '</h3></div>' +
            '<div class="core-audio-zone"><button class="core-audio-button" type="button" data-core-audio="' + point.id + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h4l5 4V6l-5 4H5Z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg><span>听本段</span></button><div class="core-inline-player" data-core-player="' + point.id + '"><input class="core-progress" type="range" min="0" max="100" value="0" step="0.1" aria-label="' + escapeHtml(point.name) + ' 播放进度"><div><span data-core-current>0:00</span><span data-core-duration>--:--</span></div></div></div>' +
          '</div>' +
          '<p class="core-detail">' + escapeHtml(point.summary + " " + detail) + '</p>' +
          '<div class="core-stop-footer"><span>' + escapeHtml(routeText) + '</span><button type="button" data-map-sub="' + point.id + '">地图定位 →</button></div>' +
        '</div>' +
      '</article>';
    }).join("");    const chapters = item.sections.map((section, index) => '<article class="chapter" id="chapter-' + index + '"><span class="chapter-number">' + pad(index + 1) + '</span><h2>' + escapeHtml(section.title) + '</h2>' + section.body.map((paragraph) => '<p>' + escapeHtml(paragraph) + "</p>").join("") + "</article>").join("");
    const chapterNav = '<a href="#core-route" class="is-active">核心路线</a>' + points.map((point) => '<a href="#core-' + point.id + '" data-chapter-link="core-' + point.id + '">' + point.order + ". " + escapeHtml(point.name) + "</a>").join("") + '<a href="#deep-reading">进一步阅读</a>';
    const related = DATA.attractions.filter((candidate) => candidate.regionId === item.regionId && candidate.id !== item.id).slice(0, 3);
    const relatedHtml = related.map((candidate) => '<button class="related-card" type="button" data-related="' + candidate.id + '">' + mediaMarkup(candidate, null, "real-photo") + '<span><strong>' + escapeHtml(candidate.name) + '</strong><small>' + escapeHtml(candidate.type) + "</small></span></button>").join("");
    const tags = (item.tags || []).map((tag) => "<span>" + escapeHtml(tag) + "</span>").join("") + "<span>" + escapeHtml(region.name) + "</span>";
    const subitem = subitemId && item.subitems ? item.subitems.find((entry) => entry.id === subitemId) : null;
    detailView.innerHTML = '<div class="detail-page" style="--hero-a:' + palette[0] + ';--hero-b:' + palette[1] + '">' +
      '<div class="detail-topbar"><button class="back-button" type="button" id="detailBack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>返回</button><div class="detail-breadcrumb">' + escapeHtml(region.name) + " / <strong>" + escapeHtml(item.name) + (subitem ? " / " + escapeHtml(subitem.name) : "") + "</strong></div></div>" +
      '<div class="detail-hero"><div class="gallery"><div class="gallery-stage">' + gallery + '<button class="gallery-nav prev" type="button" id="galleryPrev" aria-label="上一张"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><button class="gallery-nav next" type="button" id="galleryNext" aria-label="下一张"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button><div class="gallery-caption" id="galleryCaption">' + escapeHtml(galleryItems[0].title) + ' · 1/3</div><div class="gallery-dots">' + [0,1,2].map((index) => '<button class="gallery-dot' + (index === 0 ? " is-active" : "") + '" type="button" data-gallery-dot="' + index + '"></button>').join("") + "</div></div><div class=\"gallery-strip\">" + thumbs + "</div></div>" +
      '<div class="hero-copy"><div class="hero-kicker">' + tags + '</div><h1>' + escapeHtml(item.name) + '</h1><p class="latin">' + escapeHtml(item.latin) + '</p><p class="hero-summary">' + escapeHtml(item.summary) + '</p><div class="hero-facts"><div class="hero-fact"><small>建议游览</small><strong>' + escapeHtml(item.duration) + '</strong></div><div class="hero-fact"><small>最佳时段</small><strong>' + escapeHtml(item.bestTime) + '</strong></div><div class="hero-fact"><small>核心点</small><strong>' + points.length + ' 站</strong></div><div class="hero-fact"><small>所属地区</small><strong>' + escapeHtml(region.name) + '</strong></div></div><div class="hero-actions"><button class="hero-action primary" type="button" id="heroListen">从第一站开始</button><button class="hero-action" type="button" id="heroMap">地图定位</button></div></div></div>' +
      '<div id="audioTransport" class="audio-transport-hidden" hidden><button id="audioPlay" type="button"></button><strong id="audioTitle"></strong><small id="audioModeLabel"></small><input id="audioProgress" type="range" min="0" max="100" value="0"><span id="audioCurrent">0:00</span><span id="audioDuration">--:--</span><button id="audioStop" type="button"></button><button id="audioPrev" type="button"></button><button id="audioNext" type="button"></button><div id="audioSegments"></div></div>' +
      '<div class="detail-body"><nav class="chapter-nav"><h3>游览路线</h3>' + chapterNav + '</nav><article class="chapters"><section class="core-route" id="core-route"><div class="section-heading"><div><p class="eyebrow">SUGGESTED ROUTE</p><h2>按游览顺序看核心看点</h2></div><p>' + points.length + ' 站 · 每站独立图片与语音</p></div>' + pointCards + '</section><details class="deep-reading" id="deep-reading"><summary>进一步阅读：历史背景与专题讲解</summary><div class="deep-reading-content"><p class="detail-intro">' + escapeHtml(item.summary) + '</p>' + chapters + '</div></details>' + (relatedHtml ? '<section class="related-section"><div class="section-heading"><h2>同地区继续探索</h2></div><div class="related-grid">' + relatedHtml + "</div></section>" : "") + '</article><aside class="practical-card"><h3>参观要点</h3><ul>' + item.practical.map((entry) => "<li>" + escapeHtml(entry) + "</li>").join("") + '</ul><p class="source-note">图片来自 Wikimedia Commons，授权与作者信息已随本地图片清单一并保存。开放时间与现场规定可能变化，请以现场公告为准。</p></aside></div></div>';
    bindDetailInteractions(item);
    showView("detail");
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function playIcon(isPlaying) {
    return isPlaying ? '<svg viewBox="0 0 24 24"><path d="M8 6v12M16 6v12"/></svg>' : '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg>';
  }
  function bindDetailInteractions(item) {
    $("#detailBack").addEventListener("click", () => {
      if (history.length > 1) history.back(); else showView(state.previousView === "detail" ? "list" : state.previousView);
    });
    $("#heroMap").addEventListener("click", () => {
      showView("map");
      requestAnimationFrame(() => { focusMapPoint(item.coords, Math.max(2.2, state.fitZoom * 2.9)); renderMapMarkers(); });
    });
    $("#heroListen").addEventListener("click", () => { jumpToSegment(1, true); document.querySelector(".core-stop")?.scrollIntoView({ behavior: "smooth", block: "center" }); });
    bindGallery();
    bindAudio(item);
    bindChapterObserver();
    $$("[data-related]", $("#detailView")).forEach((button) => button.addEventListener("click", () => openAttraction(button.dataset.related)));
    $$("[data-core-audio]", $("#detailView")).forEach((button) => button.addEventListener("click", () => {
      const index = narrationSegments(item).findIndex((segment) => segment.subitemId === button.dataset.coreAudio);
      if (index < 0) return; if (state.audioSegment === index) audioGuide.toggleAudio(); else jumpToSegment(index, true);
    }));
    $$("[data-map-sub]", $("#detailView")).forEach((button) => button.addEventListener("click", () => {
      const subitem = item.subitems.find((entry) => entry.id === button.dataset.mapSub);
      if (!subitem) return;
      state.selectedAttractionId = item.id;
      state.selectedSubitemId = subitem.id;
      showView("map");
      requestAnimationFrame(() => { focusMapPoint(subitem.coords, Math.max(3.0, state.fitZoom * 3.5)); renderMapMarkers(); });
    }));
  }

  function bindGallery() {
    const setGallery = (index) => {
      state.galleryIndex = (index + 3) % 3;
      $$(".gallery-image").forEach((image) => image.classList.toggle("is-active", Number(image.dataset.galleryImage) === state.galleryIndex));
      $$(".gallery-thumb,.gallery-dot").forEach((control) => {
        const value = control.dataset.galleryThumb || control.dataset.galleryDot;
        control.classList.toggle("is-active", Number(value) === state.galleryIndex);
      });
      const item = attractionById[state.selectedAttractionId];
      const active = document.querySelector(".gallery-image.is-active"); $("#galleryCaption").textContent = (active?.dataset.galleryTitle || item.name) + " · " + (state.galleryIndex + 1) + "/3 · " + (active?.dataset.galleryCredit || "离线图片");
    };
    $("#galleryPrev").addEventListener("click", () => setGallery(state.galleryIndex - 1));
    $("#galleryNext").addEventListener("click", () => setGallery(state.galleryIndex + 1));
    $$("[data-gallery-thumb],[data-gallery-dot]").forEach((control) => control.addEventListener("click", () => setGallery(Number(control.dataset.galleryThumb || control.dataset.galleryDot))));
  }

  function bindChapterObserver() {
    if (!("IntersectionObserver" in window)) return;
    const links = $$("[data-chapter-link]");
    const chapters = $$(".core-stop, .chapter");
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.toggle("is-active", link.dataset.chapterLink === visible.target.id));
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, .2, .6] });
    chapters.forEach((chapter) => observer.observe(chapter));
  }
  const audioGuide = window.createAudioGuide({
    $, $$, state, escapeHtml, formatTime, clamp, playIcon, showToast,
    getItem: () => attractionById[state.selectedAttractionId],
    getSegments: narrationSegments
  });
  const bindAudio = audioGuide.bindAudio;
  const playAudio = audioGuide.playAudio;
  const stopAudio = audioGuide.stopAudio;
  const jumpToSegment = audioGuide.jumpToSegment;
  const changeSegment = audioGuide.changeSegment;
  function showView(name, updateHash) {
    const viewName = name === "detail" ? "detail" : name === "list" ? "list" : "map";
    if (state.view !== "detail" && viewName !== "detail") state.previousView = state.view;
    state.view = viewName;
    $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === viewName + "View"));
    $$("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === viewName));
    $("#mobileDetailButton").classList.toggle("is-active", viewName === "detail");
    if (updateHash !== false && viewName !== "detail") setRoute("#" + viewName);
    if (viewName === "map") requestAnimationFrame(() => updateMapTransform());
  }

  function setRoute(hash, replace) {
    if (window.location.hash === hash) return;
    if (replace) history.replaceState(null, "", hash);
    else history.pushState(null, "", hash);
  }

  function openAttraction(id, subitemId) {
    const item = attractionById[id];
    if (!item) return;
    const route = "#site/" + item.id + (subitemId ? "/sub/" + subitemId : "");
    history.pushState(null, "", route);
    renderDetail(item.id, subitemId || null);
  }

  function handleRoute() {
    const hash = window.location.hash || "#map";
    const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
    if (parts[0] === "site" && parts[1]) renderDetail(parts[1], parts[2] === "sub" && parts[3] ? parts[3] : null);
    else if (parts[0] === "list") showView("list", false);
    else showView("map", false);
  }

  function bindNavigation() {
    $$("[data-view]").forEach((button) => button.addEventListener("click", () => {
      const target = button.dataset.view;
      if (target === "detail") {
        if (state.selectedAttractionId) openAttraction(state.selectedAttractionId, state.selectedSubitemId);
        return;
      }
      showView(target);
    }));
    $(".brand").addEventListener("click", (event) => { event.preventDefault(); showView("map"); });
    window.addEventListener("popstate", handleRoute);
    window.addEventListener("hashchange", handleRoute);
  }

  function bindMapSearch() {
    $("#mapSearchInput").addEventListener("input", (event) => {
      state.mapQuery = event.target.value;
      renderMapMarkers();
    });
    $("#mapSearchInput").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const query = state.mapQuery.trim().toLowerCase();
      const item = DATA.attractions.find((entry) => searchable(entry).includes(query));
      if (!item) { showToast("没有找到匹配景点"); return; }
      focusMapPoint(item.coords, Math.max(2.35, state.fitZoom * 3));
      renderMapMarkers();
    });
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function initMap() {
    $("#mapBase").innerHTML = buildMapBase();
    state.mapReady = true;
    fitMap();
    setTimeout(() => { const loading = $("#mapLoading"); if (loading) loading.hidden = true; }, 240);
  }
  async function updateOfflineBadge() {
    const label = $("#offlineLabel");
    const badge = $("#offlineBadge");
    if (location.protocol === "file:") { label.textContent = "单文件离线"; badge.classList.remove("is-checking"); return; }
    if (!("caches" in window)) { label.textContent = navigator.onLine ? "浏览器本地模式" : "无网离线"; return; }
    try {
      const keys = await caches.keys();
      const requests = (await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()))).flat();
      const urls = requests.map((request) => request.url);
      const expectedAudio = DATA.attractions.reduce((sum, item) => sum + 1 + corePoints(item).length, 0);
      const expectedImages = Object.keys(REAL_IMAGES.attractions || {}).length + Object.values(REAL_IMAGES.subitems || {}).reduce((sum, group) => sum + Object.keys(group).length, 0);
      const actualAudio = urls.filter((url) => url.includes("/assets/audio/paragraphs-v2/")).length;
      const actualImages = urls.filter((url) => url.includes("/assets/images/real/")).length;
      const expected = expectedAudio + expectedImages;
      const actual = Math.min(actualAudio, expectedAudio) + Math.min(actualImages, expectedImages);
      const percent = expected ? Math.min(100, Math.round(actual / expected * 100)) : 0;
      if (percent >= 100) {
        label.textContent = "离线包已就绪";
        badge.classList.remove("is-checking");
      } else {
        label.textContent = navigator.onLine ? "正在缓存 " + percent + "%" : "离线可用 " + percent + "%";
        badge.classList.add("is-checking");
      }
    } catch (error) {
      label.textContent = navigator.onLine ? "正在准备离线包" : "无网离线";
    }
  }

  function registerOfflineApp() {
    updateOfflineBadge();
    window.addEventListener("online", updateOfflineBadge);
    window.addEventListener("offline", updateOfflineBadge);
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
      navigator.serviceWorker.register("./service-worker.js").then((registration) => {
        updateOfflineBadge();
        registration.update();
        setInterval(updateOfflineBadge, 3000);
      }).catch(() => {
        $("#offlineLabel").textContent = "浏览器本地模式";
      });
    }
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.installPrompt = event;
      $("#installButton").hidden = false;
    });
    $("#installButton").addEventListener("click", async () => {
      if (!state.installPrompt) { showToast("请使用浏览器菜单中的“添加到主屏幕”。"); return; }
      state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
      $("#installButton").hidden = true;
    });
    window.addEventListener("appinstalled", () => { $("#installButton").hidden = true; showToast("已安装到设备，可离线打开。"); });
  }
  function init() {
    initMap();
    renderCityRibbon();
    renderList();
    bindMapInteractions();
    bindMapSearch();
    bindListInteractions();
    bindNavigation();
    registerOfflineApp();
    if (!window.location.hash) history.replaceState(null, "", "#map");
    handleRoute();
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.view === "map" && state.mapReady) updateMapTransform();
      }, 120);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && audioGuide.isPlaying()) audioGuide.stopAudio();
      if (document.hidden && "speechSynthesis" in window) window.speechSynthesis.pause();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.view === "detail") history.back();
    });
  }

  try {
    init();
  } catch (error) {
    const loading = $("#mapLoading");
    if (loading) loading.innerHTML = "<span>离线数据加载失败：" + escapeHtml(error.message) + "</span>";
    console.error(error);
  }
})();



