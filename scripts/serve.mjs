import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = decoded === "/" ? "/index.html" : decoded;
  const full = path.resolve(root, `.${clean}`);
  if (!full.startsWith(root)) return null;
  return full;
}

const server = http.createServer(async (request, response) => {
  const file = resolvePath(request.url || "/");
  if (!file) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(file);
    response.writeHead(200, {
      "content-type": types[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(data);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`blog-micro listening at http://${host}:${port}`);
});
