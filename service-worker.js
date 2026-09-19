importScripts("./data.js", "./content-plus.js", "./subitem-plus.js", "./real-image-manifest.js");
const CACHE_NAME = "hellas-offline-v4.3.0";
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
let mediaCachePromise = null;
let cacheGeneration = 0;
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => client.postMessage(message));
}
async function cacheMediaInBackground() {
  if (mediaCachePromise) return mediaCachePromise;
  const generation = cacheGeneration;
  mediaCachePromise = (async () => {
    const cache = await caches.open(CACHE_NAME);
    const assets = audioAssets.concat(imageAssets);
    let completed = 0;
    await notifyClients({ type: "CACHE_PROGRESS", completed, total: assets.length, current: "准备缓存" });
    for (let index = 0; index < assets.length; index += 3) {
      if (generation !== cacheGeneration) return;
      const chunk = assets.slice(index, index + 3);
      await Promise.allSettled(chunk.map(async (url) => {
        const existing = await cache.match(url);
        if (!existing) await cache.add(url);
      }));
      completed += chunk.length;
      await notifyClients({ type: "CACHE_PROGRESS", completed: Math.min(completed, assets.length), total: assets.length, current: chunk[chunk.length - 1] });
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    const readyRequest = new Request(new URL("./__offline_ready__", self.location.href));
    await cache.put(readyRequest, new Response(JSON.stringify({ ready: true, total: assets.length, cachedAt: new Date().toISOString() }), { headers: { "Content-Type": "application/json" } }));
    await notifyClients({ type: "CACHE_COMPLETE", completed: assets.length, total: assets.length });
  })().finally(() => { mediaCachePromise = null; });
  return mediaCachePromise;
}self.addEventListener("install", (event) => {
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
    await self.clients.claim();  })());
});
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data.type === "CACHE_MEDIA") event.waitUntil(cacheMediaInBackground());
  if (event.data.type === "CLEAR_CACHE") event.waitUntil(clearAllCaches());
});
async function clearAllCaches() {
  cacheGeneration++;
  mediaCachePromise = null;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  await notifyClients({ type: "CACHE_CLEARED" });
}
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

















