const http = require("http");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const host = "0.0.0.0";
const baseUrl = process.env.PUBLIC_BASE_URL || "https://povmind-472136847189.europe-west1.run.app";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "worker-src 'self'"
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

function safePath(urlPath) {
  let decoded = "/";
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    decoded = "/";
  }
  const clean = decoded === "/" ? "/index.html" : decoded;
  const resolved = path.resolve(root, `.${clean}`);
  return resolved.startsWith(root) ? resolved : path.join(root, "index.html");
}

function cacheControl(filePath) {
  const name = path.basename(filePath);
  if (name === "index.html" || name === "sw.js" || name === "manifest.json") {
    return "no-cache";
  }
  return "public, max-age=3600";
}

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    ...securityHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  res.end(body);
}

function routeResponse(req, res) {
  const url = new URL(req.url || "/", baseUrl);
  if (url.pathname === "/health" || url.pathname === "/healthz" || url.pathname === "/ready") {
    writeJson(res, 200, {
      ok: true,
      service: pkg.name,
      version: pkg.version
    });
    return true;
  }

  if (url.pathname === "/version") {
    writeJson(res, 200, {
      name: "PovMind",
      package: pkg.name,
      version: pkg.version,
      environment: process.env.NODE_ENV || "development"
    });
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { ...securityHeaders, Allow: "GET, HEAD" });
    res.end();
    return;
  }

  if (routeResponse(req, res)) return;

  let filePath = safePath(req.url || "/");
  const isMissing = !fs.existsSync(filePath);
  const requestedExt = path.extname(new URL(req.url || "/", baseUrl).pathname);
  if (isMissing && requestedExt) {
    res.writeHead(404, {
      ...securityHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache"
    });
    res.end("Not found");
    return;
  }

  if (isMissing || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(root, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    ...securityHeaders,
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": cacheControl(filePath)
  };

  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`PovMind listening on http://${host}:${port}`);
});
