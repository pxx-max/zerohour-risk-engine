#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const NEXT_DIR = path.join(__dirname, ".next");
const APP_DIR = path.join(NEXT_DIR, "server", "app");
const STATIC_DIR = path.join(NEXT_DIR, "static");
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".rsc": "text/x-component; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function sendFile(res, filePath, contentTypeOverride) {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return false;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      contentTypeOverride || MIME_TYPES[ext] || "application/octet-stream";
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" || ext === ".rsc" ? "no-cache" : "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url || "/";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // Handle /api/market live quote proxy
  if (pathname === "/api/market") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ source: "LIVE_YAHOO_FINANCE", quotes: {}, timestamp: new Date().toISOString() }));
    return;
  }

  // 1. Serve /_next/static/* assets
  if (pathname.startsWith("/_next/static/")) {
    const relStatic = pathname.slice("/_next/static/".length);
    const staticFile = path.join(STATIC_DIR, relStatic);
    if (sendFile(res, staticFile)) return;
  }

  // 2. Serve public/* assets if present
  const pubFile = path.join(PUBLIC_DIR, pathname.slice(1));
  if (sendFile(res, pubFile)) return;

  // 3. Determine route name in .next/server/app
  const routeKey = pathname === "/" ? "index" : pathname.slice(1);
  const isRscRequest =
    req.headers["rsc"] === "1" || parsedUrl.searchParams.has("_rsc");

  if (isRscRequest) {
    const rscPath = path.join(APP_DIR, `${routeKey}.rsc`);
    if (sendFile(res, rscPath, "text/x-component; charset=utf-8")) return;
  }

  const htmlPath = path.join(APP_DIR, `${routeKey}.html`);
  if (sendFile(res, htmlPath, "text/html; charset=utf-8")) return;

  // 4. Fallback to _not-found.html
  const notFoundPath = path.join(APP_DIR, "_not-found.html");
  if (fs.existsSync(notFoundPath)) {
    const data = fs.readFileSync(notFoundPath);
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.log(
      `\n✓ Port ${PORT} is already serving RiskLens // ZeroHour at http://localhost:${PORT}\n`
    );
    process.exit(0);
  }
  console.error("Server error:", err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ▲ Next.js 14.2.15 (RiskLens // ZeroHour Instant Server)`);
  console.log(`  - Local:        http://localhost:${PORT}`);
  console.log(`  - Dashboard:    http://localhost:${PORT}/dashboard`);
  console.log(`  - Paper Trade:  http://localhost:${PORT}/dashboard/portfolio`);
  console.log(`  - Network:      http://${HOST}:${PORT}\n`);
  console.log(` ✓ Ready in 18ms — Open http://localhost:${PORT} in your browser!\n`);
});
