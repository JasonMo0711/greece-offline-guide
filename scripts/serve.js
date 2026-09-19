const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".wav": "audio/wav", ".txt": "text/plain; charset=utf-8"
};
http.createServer((request, response) => {
  const urlPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.resolve(root, "." + requested);
  if (!filePath.startsWith(root)) { response.writeHead(403); response.end("Forbidden"); return; }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404); response.end("Not found"); return; }
    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Accept-Ranges": "bytes",
      "Content-Length": stat.size
    });
    fs.createReadStream(filePath).pipe(response);
  });
}).listen(port, "127.0.0.1", () => console.log("Offline guide: http://127.0.0.1:" + port));


