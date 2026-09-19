const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const dataSandbox = {};
const subitemSandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), { self: dataSandbox }, { filename: "data.js" });
vm.runInNewContext(fs.readFileSync(path.join(root, "subitem-plus.js"), "utf8"), { self: subitemSandbox }, { filename: "subitem-plus.js" });
const data = dataSandbox.GUIDE_DATA;
const subitemContent = subitemSandbox.GUIDE_SUBITEM_PLUS || {};
if (!data || !Array.isArray(data.attractions)) throw new Error("无法读取景点数据");
const outDir = path.join(root, "assets", "audio", "narration-text");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
let count = 0;
for (const item of data.attractions) {
  const dir = path.join(outDir, item.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "overview.txt"), item.name + "。" + item.summary, "utf8");
  count++;
  const config = subitemContent[item.id] || {};
  const order = config.route || (item.subitems || []).map((subitem) => subitem.id);
  for (const id of order) {
    const subitem = (item.subitems || []).find((entry) => entry.id === id);
    if (!subitem) continue;
    const detail = config.details && config.details[id] ? config.details[id] : subitem.summary;
    fs.writeFileSync(path.join(dir, "core-" + id + ".txt"), subitem.name + "。" + detail, "utf8");
    count++;
  }
}
console.log("已生成 " + count + " 段逐站讲解文本。");
