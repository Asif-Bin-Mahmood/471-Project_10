const fs = require("fs");
const path = require("path");
const { sendJson } = require("./http");

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  return "application/octet-stream";
}

function serveStatic(req, res, publicDir, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const target = path.normalize(path.join(publicDir, safePath));

  if (!target.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(target, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypeFor(target) });
    res.end(data);
  });
}

module.exports = {
  serveStatic
};
