import crypto from "node:crypto";
import { join, normalize } from "node:path";

const publicDir = join(import.meta.dir, "public");
const VALID_STATUSES = ["received", "in-review", "approved", "denied"];
const port = Number(process.env.PORT || 3000);
const requests = [];

function withCorsHeaders(origin) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers
  });
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handleGetRequests(url, corsHeaders) {
  const status = url.searchParams.get("status");
  const filtered = status ? requests.filter((request) => request.status === status) : requests;
  const sorted = [...filtered].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return jsonResponse(sorted, 200, corsHeaders);
}

async function handlePostRequests(request, corsHeaders) {
  const body = (await parseJson(request)) || {};
  const now = new Date().toISOString();

  const doc = {
    id: crypto.randomUUID(),
    email: body.email?.trim().toLowerCase(),
    employeeName: body.employeeName?.trim() || "",
    currentSite: body.currentSite,
    preferredSite: body.preferredSite,
    preferredShift: body.preferredShift,
    notes: body.notes?.trim() || "",
    status: "received",
    submittedAt: now,
    updatedAt: now
  };

  if (!doc.email || !doc.currentSite || !doc.preferredSite || !doc.preferredShift) {
    return jsonResponse({ error: "Missing required fields." }, 400, corsHeaders);
  }

  requests.push(doc);
  return jsonResponse(doc, 201, corsHeaders);
}

async function handlePatchStatus(request, id, corsHeaders) {
  const body = (await parseJson(request)) || {};
  const { status: newStatus, denialReason } = body;

  if (!VALID_STATUSES.includes(newStatus)) {
    return jsonResponse({ error: "Invalid status value" }, 400, corsHeaders);
  }

  if (newStatus === "denied" && (!denialReason || !denialReason.trim())) {
    return jsonResponse(
      { error: "denialReason is required when denied" },
      400,
      corsHeaders
    );
  }

  const item = requests.find((request) => request.id === id);
  if (!item) {
    return jsonResponse({ error: "Request not found" }, 404, corsHeaders);
  }

  item.status = newStatus;
  item.updatedAt = new Date().toISOString();

  if (newStatus === "denied") item.denialReason = denialReason.trim();
  else delete item.denialReason;

  return jsonResponse(item, 200, corsHeaders);
}

async function serveStatic(pathname) {
  const normalizedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const candidate = normalize(join(publicDir, normalizedPath));

  if (!candidate.startsWith(publicDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  const extensionsToTry = ["", ".html"];
  for (const ext of extensionsToTry) {
    const filePath = candidate.endsWith(ext) ? candidate : `${candidate}${ext}`;
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }
  }

  return new Response("Not found", { status: 404 });
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    const corsHeaders = withCorsHeaders(request.headers.get("origin"));

    try {
      if (pathname === "/api/requests") {
        if (method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders });
        if (method === "GET") return await handleGetRequests(url, corsHeaders);
        if (method === "POST") return await handlePostRequests(request, corsHeaders);
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
      }

      const statusRouteMatch = pathname.match(/^\/api\/requests\/([^/]+)\/status$/);
      if (statusRouteMatch) {
        if (method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders });
        if (method === "PATCH") {
          const id = decodeURIComponent(statusRouteMatch[1]);
          return await handlePatchStatus(request, id, corsHeaders);
        }
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
      }

      return serveStatic(pathname);
    } catch (error) {
      console.error("Request handling failed", error);
      return jsonResponse({ error: "Internal server error" }, 500, corsHeaders);
    }
  }
});

console.log(`Transfer Portal server running on http://localhost:${port}`);
