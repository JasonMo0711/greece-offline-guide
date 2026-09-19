importScripts("./data.js", "./content-plus.js", "./subitem-plus.js", "./real-image-manifest.js");
const CACHE_NAME = "hellas-offline-v3.0.0";
const SHELL_ASSETS = ["./","./index.html","./pc.html","./mobile.html","./styles.css","./versions.css","./data.js","./content-plus.js","./subitem-plus.js","./real-image-manifest.js","./audio-engine.js","./app.js","./manifest.webmanifest","./assets/icons/icon-192.png","./assets/icons/icon-512.png","./assets/icons/maskable-512.png"];
const coreConfig = self.GUIDE_SUBITEM_PLUS || {};
const audioAssets = self.GUIDE_DATA.attractions.flatMap((item) => {
  const config = coreConfig[item.id] || {};
  const order = config.route || (item.subitems || []).map((subitem) => subitem.id);
  return ["./assets/audio/paragraphs-v2/" + item.id + "/overview.wav"].concat(order.map((id) => "./assets/audio/paragraphs-v2/" + item.id + "/core-" + id + ".wav"));
});
const imageAssets = [];
const imageManifest = self.GUIDE_REAL_IMAGES || { attractions: {}, subitems: {} };
Object.values(imageManifest.attractions || {}).forEach((entry) => imageAssets.push(entry.localPath));
Object.values(imageManifest.subitems || {}).forEach((group) => Object.values(group).forEach((entry) => imageAssets.push(entry.localPath)));
async function cacheMediaInBackground() {
  const cache = await caches.open(CACHE_NAME);
  const assets = audioAssets.concat(imageAssets);
  for (let index = 0; index < assets.length; index += 4) {
    await Promise.allSettled(assets.slice(index, index + 4).map((url) => cache.add(url)));
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_ASSETS);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
    cacheMediaInBackground();
  })());
});
self.addEventListener("message", (event) => { if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === "navigate") return caches.match("./index.html");
      throw error;
    }
  })());
});










