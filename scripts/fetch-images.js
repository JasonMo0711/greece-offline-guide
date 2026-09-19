const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const outRoot = path.join(root, "assets", "images", "real");
const dataSandbox = {};
const plusSandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), { self: dataSandbox }, { filename: "data.js" });
vm.runInNewContext(fs.readFileSync(path.join(root, "content-plus.js"), "utf8"), { self: plusSandbox }, { filename: "content-plus.js" });
const data = dataSandbox.GUIDE_DATA;
const extras = plusSandbox.GUIDE_CONTENT_PLUS || {};
for (const attraction of data.attractions) {
  if (extras[attraction.id]) attraction.sections.push(...extras[attraction.id]);
}

const overrides = {
  "herod-att": "Odeon of Herodes Atticus", "tower-winds": "Tower of the Winds Athens",
  "athena-gate": "Gate of Athena Archegetis", "pantanassa": "Pantanassa Church Monastiraki",
  "metro-archaeology": "Monastiraki metro station archaeological display",
  "philopappos-monument": "Philopappos Monument", "socrates-cave": "Socrates prison Philopappos",
  "academy-athens": "Academy of Athens building", "national-library": "National Library of Greece building",
  "garden-pond": "National Garden Athens pond", "garden-ruins": "National Garden Athens ruins",
  "marble-seats": "Panathenaic Stadium marble seats", "athlete-tunnel": "Panathenaic Stadium tunnel",
  "zeus-columns": "Temple of Olympian Zeus columns Athens", "zeus-cella": "Temple of Olympian Zeus cella",
  "arch-inscription": "Arch of Hadrian inscription Athens", "arch-cornice": "Arch of Hadrian Athens",
  "view-deck": "Mount Lycabettus view Athens", "st-george": "Saint George church Lycabettus",
  "apollo-temple-delphi": "Temple of Apollo Delphi", "athenian-treasury": "Athenian Treasury Delphi",
  "delphi-theatre": "Ancient theatre Delphi", "delphi-stadium": "Ancient stadium Delphi",
  "charioteer-base": "Charioteer of Delphi", "tholos": "Tholos Delphi",
  "naxian-sphinx": "Naxian Sphinx Delphi", "siphnian-frieze": "Siphnian Treasury frieze Delphi",
  "kleobis-biton": "Cleobis and Biton Delphi", "great-meteoron": "Great Meteoron Monastery",
  "varlaam": "Varlaam Monastery Meteora", "rousanou": "Rousanou Monastery Meteora",
  "st-nicholas": "Saint Nicholas Anapafsas Monastery", "holy-trinity": "Holy Trinity Monastery Meteora",
  "st-stephen": "Saint Stephen Monastery Meteora", "andrew-relic": "Saint Andrew relic Patras",
  "old-andrew": "Old Church of Saint Andrew Patras", "andrew-cross": "Saint Andrew cross Patras",
  "odeon-cavea": "Roman Odeon Patras", "odeon-stage": "Roman Odeon Patras stage",
  "patras-keep": "Patras Castle keep", "patras-walls": "Patras Castle walls",
  "patras-view": "Patras Castle view", "panagiotis": "MV Panagiotis Navagio",
  "navagio-cliffs": "Navagio beach cliffs", "navagio-viewpoint": "Navagio viewpoint",
  "azure-cave": "Blue Caves Zakynthos", "skinari": "Cape Skinari lighthouse",
  "blue-cave-swim": "Blue Caves Zakynthos swimming", "temple-zeus-olympia": "Temple of Zeus Olympia",
  "temple-hera": "Temple of Hera Olympia", "olympic-stadium": "Ancient stadium Olympia",
  "phidias-workshop": "Workshop of Phidias Olympia", "philippeion": "Philippeion Olympia",
  "hermes-praxiteles": "Hermes of Praxiteles", "zeus-pediments": "Temple of Zeus pediments Olympia",
  "nike-paionios": "Nike of Paionios", "palamidi-bastions": "Palamidi fortress bastions",
  "palamidi-prison": "Palamidi prison Nafplio", "palamidi-view": "Palamidi view Nafplio",
  "lion-gate": "Lion Gate Mycenae", "grave-circle-a": "Grave Circle A Mycenae",
  "mycenae-palace": "Palace of Mycenae", "atreus-treasury": "Treasury of Atreus",
  "apollo-corinth": "Temple of Apollo Ancient Corinth", "bema-paul": "Bema of Saint Paul Corinth",
  "peirene": "Peirene Fountain Corinth", "acrrocorinth": "Acrocorinth",
  "canal-bridge": "Corinth Canal bridge", "diolkos": "Diolkos Corinth", "isthmia": "Isthmia Corinth Canal",
  "oia-main-square": "Oia main square Santorini", "oia-blue-domes": "Oia blue domes Santorini",
  "oia-windmills": "Oia windmills Santorini", "oia-castle": "Oia Castle Santorini", "armeni-bay": "Armeni Bay Santorini",
  "red-cliffs": "Red Beach Santorini cliffs", "red-shore": "Red Beach Santorini",
  "akrotiri-castle-view": "Akrotiri Castle Santorini", "perissa": "Perissa black beach Santorini",
  "kamari": "Kamari black beach Santorini", "perivolos": "Perivolos beach Santorini",
  "white-cliffs": "White Beach Santorini cliffs", "white-cove": "White Beach Santorini",
  "nea-kameni": "Nea Kameni volcano", "hot-springs": "Santorini hot springs", "mik-ash": "Minoan eruption Santorini",
  "fira-museum": "Museum of Prehistoric Thera", "fira-cable-car": "Fira cable car Santorini",
  "old-port": "Fira Old Port Santorini", "three-bells-fira": "Three Bells of Fira",
  "pyrgos-castle": "Pyrgos Castle Santorini", "pyrgos-churches": "Pyrgos churches Santorini",
  "pyrgos-viewpoint": "Pyrgos Santorini viewpoint"
};

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function scoreCandidate(candidate, query) {
  const title = candidate.title.toLowerCase();
  const tokens = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 3);
  let score = 100 - candidate.index;
  tokens.forEach((token) => { if (title.includes(token)) score += 7; });
  if (/\.(jpe?g|png|webp)$/i.test(candidate.title)) score += 8;
  if (/map|plan|diagram|drawing|sketch|logo|icon|coat of arms|reconstruction/i.test(title)) score -= 100;
  if (/panorama|view/i.test(title)) score += 2;
  return score;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchCommons(query) {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: "filetype:bitmap " + query,
    gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata", iiurlwidth: "1000", format: "json", formatversion: "2"
  });
  let response;
  let payload;
  for (let attempt = 0; attempt < 5; attempt++) {
    response = await fetch("https://commons.m.wikimedia.org/w/api.php?" + params.toString(), {
      headers: { "User-Agent": "HellasOfflineGuide/1.0 (educational offline travel guide)" }
    });
    if (response.status === 429) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error("Commons HTTP " + response.status);
    payload = await response.json();
    if (payload.error && /too many requests|maxlag/i.test(payload.error.code + " " + payload.error.info)) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    break;
  }
  await sleep(300);
  if (!payload) throw new Error("Commons rate limit");
  const pages = payload.query && payload.query.pages ? payload.query.pages : [];
  const candidates = pages.map((page, index) => {
    const info = page.imageinfo && page.imageinfo[0];
    return info ? { page, info, index, title: page.title, score: 0 } : null;
  }).filter(Boolean).filter((candidate) => /^image\//.test(candidate.info.mime || "") && candidate.info.thumburl);
  candidates.forEach((candidate) => { candidate.score = scoreCandidate(candidate, query); });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function targetList() {
  const targets = [];
  for (const attraction of data.attractions) {
    targets.push({
      key: attraction.id, kind: "attraction", attractionId: attraction.id,
      query: (attraction.latin || attraction.name) + " Greece",
      localBase: path.join("assets", "images", "real", "attractions", attraction.id)
    });
    for (const subitem of attraction.subitems || []) {
      const override = overrides[subitem.id];
      targets.push({
        key: attraction.id + "__" + subitem.id, kind: "subitem", attractionId: attraction.id,
        query: override || ((attraction.latin || attraction.name) + " " + subitem.id.replace(/-/g, " ")),
        localBase: path.join("assets", "images", "real", "subitems", attraction.id + "__" + subitem.id)
      });
    }
  }
  return targets;
}

function extensionFor(mime, url) {
  if (/png/i.test(mime) || /\.png($|\?)/i.test(url)) return ".png";
  if (/webp/i.test(mime) || /\.webp($|\?)/i.test(url)) return ".webp";
  return ".jpg";
}

async function fetchOne(target) {
  let candidate = await searchCommons(target.query).catch(() => null);
  if (!candidate) candidate = await searchCommons(target.query.replace(/ Greece$/i, "")).catch(() => null);
  if (!candidate) return { ok: false, target, error: "no image result" };
  const info = candidate.info;
  const ext = extensionFor(info.mime, info.thumburl);
  const localBase = target.localBase.replace(/\.(jpg|png|webp)$/i, "");
  const localPath = localBase + ext;
  fs.mkdirSync(path.dirname(path.join(root, localPath)), { recursive: true });
  const response = await fetch(info.thumburl, {
    headers: { "User-Agent": "HellasOfflineGuide/1.0 (educational offline travel guide)" }
  });
  if (!response.ok) return { ok: false, target, error: "download HTTP " + response.status };
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(path.join(root, localPath), bytes);
  const meta = info.extmetadata || {};
  return {
    ok: true, target, file: localPath.replace(/\\/g, "/"),
    entry: {
      id: target.key, kind: target.kind, attractionId: target.attractionId,
      localPath: "./" + localPath.replace(/\\/g, "/"),
      title: candidate.title.replace(/^File:/, ""),
      sourceUrl: info.descriptionurl || ("https://commons.wikimedia.org/wiki/" + encodeURIComponent(candidate.title)),
      query: target.query,
      artist: stripHtml(meta.Artist && meta.Artist.value) || "Wikimedia Commons contributor",
      license: stripHtml(meta.LicenseShortName && meta.LicenseShortName.value) || "Wikimedia Commons",
      licenseUrl: stripHtml(meta.LicenseUrl && meta.LicenseUrl.value),
      description: stripHtml(meta.ImageDescription && meta.ImageDescription.value).slice(0, 240)
    }
  };
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
      if ((index + 1) % 10 === 0 || index === items.length - 1) console.log((index + 1) + "/" + items.length);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

(async () => {
  fs.mkdirSync(outRoot, { recursive: true });
  const targets = targetList();
  const results = await mapConcurrent(targets, 2, async (target) => {
    try { return await fetchOne(target); }
    catch (error) { return { ok: false, target, error: error.message }; }
  });
  const manifest = { generatedAt: new Date().toISOString(), attractions: {}, subitems: {}, failures: [] };
  for (const result of results) {
    if (!result.ok) { manifest.failures.push({ id: result.target.key, query: result.target.query, error: result.error }); continue; }
    if (result.target.kind === "attraction") manifest.attractions[result.target.attractionId] = result.entry;
    else {
      manifest.subitems[result.target.attractionId] ||= {};
      manifest.subitems[result.target.attractionId][result.target.key.split("__").pop()] = result.entry;
    }
  }
  fs.writeFileSync(path.join(outRoot, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(path.join(root, "real-image-manifest.js"), "(function (root) { root.GUIDE_REAL_IMAGES = " + JSON.stringify(manifest, null, 2) + "; })(typeof self !== \"undefined\" ? self : window);\n", "utf8");
  console.log("完成：" + (results.length - manifest.failures.length) + "/" + results.length + " 张图片；失败 " + manifest.failures.length + " 张。");
  if (manifest.failures.length) console.log(JSON.stringify(manifest.failures.slice(0, 30), null, 2));
})();





