const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const host = "0.0.0.0";
const baseUrl = process.env.PUBLIC_BASE_URL || "https://povmind-472136847189.europe-west1.run.app";
const githubClientId = process.env.GITHUB_CLIENT_ID || "";
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || "";
const githubScope = process.env.GITHUB_OAUTH_SCOPE || "repo";
const githubTokenKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || "";
const githubStateCookie = "povmind_gh_state";
const githubTokenCookie = "povmind_gh_token";
const maxJsonBodyBytes = Number(process.env.MAX_JSON_BODY_BYTES || 8 * 1024 * 1024);

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
    "connect-src 'self' https://api.github.com",
    "font-src 'self' data:",
    "form-action 'self' https://github.com",
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

function writeJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    ...securityHeaders,
    ...extraHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  res.end(body);
}

function writeHtml(res, statusCode, body, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...securityHeaders,
    ...extraHeaders,
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  res.end(body);
}

function githubConfigured() {
  return Boolean(githubClientId && githubClientSecret);
}

function parseCookies(header = "") {
  return Object.fromEntries(
    String(header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        const key = index >= 0 ? part.slice(0, index) : part;
        const value = index >= 0 ? part.slice(index + 1) : "";
        return [decodeURIComponent(key), decodeURIComponent(value)];
      })
  );
}

function isSecureCookie() {
  return baseUrl.startsWith("https://");
}

function cookieHeader(name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Number(options.maxAge)}`);
  parts.push(`Path=${options.path || "/"}`);
  parts.push("HttpOnly");
  parts.push("SameSite=Lax");
  if (isSecureCookie()) parts.push("Secure");
  return parts.join("; ");
}

function clearCookieHeader(name, pathValue = "/") {
  return cookieHeader(name, "", { maxAge: 0, path: pathValue });
}

function tokenCipherKey() {
  if (!githubTokenKey) return null;
  return crypto.createHash("sha256").update(githubTokenKey).digest();
}

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function fromB64url(value) {
  return Buffer.from(String(value || ""), "base64url");
}

function encryptToken(token) {
  const key = tokenCipherKey();
  if (!key) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(token), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", b64url(iv), b64url(tag), b64url(encrypted)].join(".");
}

function decryptToken(value) {
  const key = tokenCipherKey();
  if (!key || !value) return "";
  const [version, ivText, tagText, encryptedText] = String(value).split(".");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, fromB64url(ivText));
    decipher.setAuthTag(fromB64url(tagText));
    return Buffer.concat([decipher.update(fromB64url(encryptedText)), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function cleanGithubRepoFullName(value) {
  const withoutUrl = String(value || "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, "");
  const parts = withoutUrl.split("/").filter(Boolean).slice(0, 2);
  if (parts.length !== 2) return "";
  return parts
    .map((part) => part.replace(/[^a-z0-9_.-]/gi, "").slice(0, 64))
    .filter(Boolean)
    .join("/");
}

function cleanGithubBranch(value) {
  return String(value || "main")
    .trim()
    .replace(/[^a-z0-9_./-]/gi, "")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 120) || "main";
}

function cleanGithubBasePath(value) {
  const clean = String(value || ".povmind")
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/")
    .slice(0, 160);
  return clean || ".povmind";
}

function cleanArchivePath(value) {
  return String(value || "")
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/")
    .slice(0, 240);
}

async function parseJsonBody(req, limit = maxJsonBodyBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("JSON body too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function githubFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const error = new Error(payload?.message || `GitHub HTTP ${response.status}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function githubApi(token, endpoint, options = {}) {
  return githubFetch(`https://api.github.com${endpoint}`, {
    method: options.method || "GET",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "PovMind",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

function githubTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return decryptToken(cookies[githubTokenCookie]);
}

function repoParts(repoFullName) {
  const clean = cleanGithubRepoFullName(repoFullName);
  const [owner, repo] = clean.split("/");
  if (!owner || !repo) {
    const error = new Error("repoFullName must use owner/repo");
    error.statusCode = 400;
    throw error;
  }
  return { owner, repo, fullName: `${owner}/${repo}` };
}

function refEndpoint(owner, repo, branch) {
  return `/repos/${owner}/${repo}/git/ref/heads/${cleanGithubBranch(branch).split("/").map(encodeURIComponent).join("/")}`;
}

async function pushGithubFiles(token, body) {
  const { owner, repo, fullName } = repoParts(body.repoFullName);
  const branch = cleanGithubBranch(body.branch);
  const basePath = cleanGithubBasePath(body.basePath);
  const files = Array.isArray(body.files) ? body.files : [];
  const tree = files
    .map((file) => ({
      path: cleanArchivePath(file.path),
      mode: "100644",
      type: "blob",
      content: String(file.content ?? "")
    }))
    .filter((file) => file.path === "AGENTS.md" || file.path.startsWith(`${basePath}/`));

  if (!tree.length) {
    const error = new Error("No PovMind context files to push");
    error.statusCode = 400;
    throw error;
  }
  if (tree.length > 300) {
    const error = new Error("Too many files for one GitHub context push");
    error.statusCode = 413;
    throw error;
  }

  const ref = await githubApi(token, refEndpoint(owner, repo, branch));
  const parentSha = ref.object?.sha;
  const parent = await githubApi(token, `/repos/${owner}/${repo}/git/commits/${parentSha}`);
  const nextTree = await githubApi(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: {
      base_tree: parent.tree.sha,
      tree
    }
  });
  const commit = await githubApi(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: {
      message: String(body.message || `Sync PovMind context ${new Date().toISOString()}`).slice(0, 180),
      tree: nextTree.sha,
      parents: [parentSha]
    }
  });
  await githubApi(token, refEndpoint(owner, repo, branch), {
    method: "PATCH",
    body: {
      sha: commit.sha,
      force: false
    }
  });

  return {
    ok: true,
    repo: fullName,
    branch,
    basePath,
    commit: commit.sha,
    files: tree.length
  };
}

async function pullGithubFiles(token, body) {
  const { owner, repo, fullName } = repoParts(body.repoFullName);
  const branch = cleanGithubBranch(body.branch);
  const basePath = cleanGithubBasePath(body.basePath);
  const ref = await githubApi(token, refEndpoint(owner, repo, branch));
  const commitSha = ref.object?.sha;
  const commit = await githubApi(token, `/repos/${owner}/${repo}/git/commits/${commitSha}`);
  const tree = await githubApi(token, `/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`);
  const wanted = (tree.tree || [])
    .filter((item) => item.type === "blob")
    .filter((item) => item.path === "AGENTS.md" || item.path.startsWith(`${basePath}/`))
    .slice(0, 300);

  const files = [];
  for (const item of wanted) {
    const blob = await githubApi(token, `/repos/${owner}/${repo}/git/blobs/${item.sha}`);
    const content = Buffer.from(String(blob.content || "").replace(/\n/g, ""), blob.encoding || "base64").toString("utf8");
    files.push({ path: item.path, content });
  }

  return {
    ok: true,
    repo: fullName,
    branch,
    basePath,
    commit: commitSha,
    files
  };
}

async function exchangeGithubCode(code, redirectUri) {
  return githubFetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PovMind"
    },
    body: new URLSearchParams({
      client_id: githubClientId,
      client_secret: githubClientSecret,
      code,
      redirect_uri: redirectUri
    })
  });
}

function githubStatus(req) {
  return {
    configured: githubConfigured(),
    authenticated: Boolean(githubTokenFromRequest(req)),
    provider: "github",
    scopes: githubScope.split(/[,\s]+/).filter(Boolean),
    tokenStorage: "server-http-only",
    tokenEncryptionConfigured: Boolean(githubTokenKey),
    browserReceivesToken: false
  };
}

function handleGithubStart(req, res, url) {
  if (!githubConfigured()) {
    writeJson(res, 501, {
      ok: false,
      error: "github_oauth_not_configured",
      message: "Configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on Cloud Run."
    });
    return;
  }

  const state = crypto.randomBytes(18).toString("base64url");
  const redirectUri = process.env.GITHUB_REDIRECT_URI || new URL("/auth/github/callback", baseUrl).toString();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", githubClientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", githubScope);
  authorize.searchParams.set("state", state);
  if (url.searchParams.get("repo")) authorize.searchParams.set("login", url.searchParams.get("repo").split("/")[0]);

  res.writeHead(302, {
    ...securityHeaders,
    "Set-Cookie": cookieHeader(githubStateCookie, state, { maxAge: 600, path: "/auth/github" }),
    "Location": authorize.toString()
  });
  res.end();
}

async function handleGithubCallback(req, res, url) {
  if (!githubConfigured()) {
    writeJson(res, 501, { ok: false, error: "github_oauth_not_configured" });
    return;
  }

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const cookies = parseCookies(req.headers.cookie);
  if (!code || !state || cookies[githubStateCookie] !== state) {
    writeJson(res, 400, { ok: false, error: "invalid_oauth_state" });
    return;
  }

  const redirectUri = process.env.GITHUB_REDIRECT_URI || new URL("/auth/github/callback", baseUrl).toString();
  const tokenPayload = await exchangeGithubCode(code, redirectUri);
  if (!tokenPayload.access_token) {
    writeJson(res, 502, { ok: false, error: "github_token_exchange_failed", details: tokenPayload });
    return;
  }

  if (!githubTokenKey) {
    writeHtml(res, 200, "<!doctype html><meta charset=\"utf-8\"><title>PovMind GitHub</title><p>GitHub connecté, mais le token n'a pas été conservé : configure <code>GITHUB_TOKEN_ENCRYPTION_KEY</code> sur Cloud Run pour activer push/pull.</p>", {
      "Set-Cookie": clearCookieHeader(githubStateCookie, "/auth/github")
    });
    return;
  }

  writeHtml(res, 200, "<!doctype html><meta charset=\"utf-8\"><title>PovMind GitHub</title><p>GitHub connecté à PovMind. Tu peux fermer cette fenêtre et relancer Push ou Pull.</p>", {
    "Set-Cookie": [
      cookieHeader(githubTokenCookie, encryptToken(tokenPayload.access_token), { maxAge: 60 * 60 * 24 * 30, path: "/" }),
      clearCookieHeader(githubStateCookie, "/auth/github")
    ]
  });
}

async function routeResponse(req, res) {
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

  if (url.pathname === "/api/github/status") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { ...securityHeaders, Allow: "GET, HEAD" });
      res.end();
      return true;
    }
    writeJson(res, 200, githubStatus(req));
    return true;
  }

  if (url.pathname === "/auth/github/start") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { ...securityHeaders, Allow: "GET, HEAD" });
      res.end();
      return true;
    }
    handleGithubStart(req, res, url);
    return true;
  }

  if (url.pathname === "/auth/github/callback") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { ...securityHeaders, Allow: "GET, HEAD" });
      res.end();
      return true;
    }
    await handleGithubCallback(req, res, url);
    return true;
  }

  if (url.pathname === "/api/github/push-context" || url.pathname === "/api/github/pull-context") {
    if (req.method !== "POST") {
      res.writeHead(405, { ...securityHeaders, Allow: "POST" });
      res.end();
      return true;
    }
    if (!githubConfigured() || !githubTokenKey) {
      writeJson(res, 501, {
        ok: false,
        error: "github_connector_not_configured",
        message: "Configure GitHub OAuth secrets and GITHUB_TOKEN_ENCRYPTION_KEY on Cloud Run."
      });
      return true;
    }
    const token = githubTokenFromRequest(req);
    if (!token) {
      writeJson(res, 401, {
        ok: false,
        error: "github_not_authenticated",
        message: "Open /auth/github/start before pushing or pulling context."
      });
      return true;
    }
    const body = await parseJsonBody(req);
    const payload = url.pathname.endsWith("push-context")
      ? await pushGithubFiles(token, body)
      : await pullGithubFiles(token, body);
    writeJson(res, 200, payload);
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (await routeResponse(req, res)) return;

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { ...securityHeaders, Allow: "GET, HEAD" });
      res.end();
      return;
    }

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
  } catch (error) {
    console.error(error);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    writeJson(res, Number(error.statusCode || 500), {
      ok: false,
      error: error.message || "PovMind server error"
    });
  }
});

server.listen(port, host, () => {
  console.log(`PovMind listening on http://${host}:${port}`);
});
