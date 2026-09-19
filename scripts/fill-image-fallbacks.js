const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "assets", "images", "real", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
function ext(localPath) { return path.extname(localPath) || ".jpg"; }
function copyFallback(source, relativeBase, note) {
  const destination = relativeBase + ext(source.localPath);
  const sourceAbs = path.join(root, source.localPath.replace(/^\.\//, ""));
  const destinationAbs = path.join(root, destination);
  fs.mkdirSync(path.dirname(destinationAbs), { recursive: true });
  fs.copyFileSync(sourceAbs, destinationAbs);
  return { ...source, localPath: "./" + destination.replace(/\\/g, "/"), fallback: true, fallbackNote: note };
}
const failures = manifest.failures || [];
for (const failure of failures) {
  const [attractionId, subitemId] = failure.id.split("__");
  const attractionEntries = manifest.subitems[attractionId] ? Object.values(manifest.subitems[attractionId]) : [];
  if (!subitemId) {
    if (manifest.attractions[attractionId]) continue;
    const fallback = attractionEntries[0] || Object.values(manifest.attractions)[0];
    manifest.attractions[attractionId] = copyFallback(fallback, "assets/images/real/attractions/" + attractionId, "同一景点已授权照片回退");
  } else {
    if (manifest.subitems[attractionId] && manifest.subitems[attractionId][subitemId]) continue;
    manifest.subitems[attractionId] ||= {};
    const fallback = manifest.attractions[attractionId] || attractionEntries[0] || Object.values(manifest.attractions)[0];
    manifest.subitems[attractionId][subitemId] = copyFallback(fallback, "assets/images/real/subitems/" + attractionId + "__" + subitemId, "同一景点已授权照片回退");
  }
}
manifest.failures = [];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
fs.writeFileSync(path.join(root, "real-image-manifest.js"), "(function (root) { root.GUIDE_REAL_IMAGES = " + JSON.stringify(manifest, null, 2) + "; })(typeof self !== \"undefined\" ? self : window);\n", "utf8");
console.log("图片回退填充完成：景点 " + Object.keys(manifest.attractions).length + "，核心点 " + Object.values(manifest.subitems).reduce((n, group) => n + Object.keys(group).length, 0));


