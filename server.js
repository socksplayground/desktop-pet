const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname);
const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";

const allowedFiles = new Set(["index.html", "pet.html", "toolbar.html"]);
const allowedDirs = new Set(["src", "assets", "build"]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${host}:${port}`);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const requestedPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const relativePath = path.normalize(requestedPath);
  const filePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, filePath);
  const parts = relativeToRoot.split(path.sep);
  const topLevel = parts[0];

  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    parts.some((part) => part.startsWith(".")) ||
    (!allowedFiles.has(relativeToRoot) && !allowedDirs.has(topLevel))
  ) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

server.listen(port, host, () => {
  console.log(`Desktop dog preview: http://${host}:${port}`);
});
