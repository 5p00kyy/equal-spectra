import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 4179);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    let route = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    ).replace(/^\/+/, "");
    if (!route) route = "index.html";
    if (route === "equal-spectra" || route === "equal-spectra/")
      route = "index.html";
    else if (route.startsWith("equal-spectra/")) route = route.slice(14);
    if (
      !/^(index\.html|README\.md|src\/[^/]+\.(js|css)|test\/[^/]+\.test\.js|assets\/[^/]+\.(svg|png)|downloads\/[^/]+\.(pdf|html|zip)|research\/[^/]+\.(js|html|json))$/.test(
        route,
      )
    ) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const file = path.resolve(root, route);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log("Equal Spectra preview ready at http://127.0.0.1:" + port),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
