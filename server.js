import crypto from "node:crypto";
import { join, normalize } from "node:path";
import { Database } from "bun:sqlite";

const publicDir = join(import.meta.dir, "public");
const VALID_STATUSES = ["received", "in-review", "approved", "denied"];
const port = Number(process.env.PORT || 3000);

// Initialize SQLite database
const db = new Database("transfer-portal.db");

// Create requests table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    employeeName TEXT,
    currentSite TEXT NOT NULL,
    preferredSite TEXT NOT NULL,
    preferredShift TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    denialReason TEXT,
    submittedAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

// Create index on status for faster filtering
db.run(`CREATE INDEX IF NOT EXISTS idx_status ON requests(status)`);

// Prepared statements for better performance
const insertRequest = db.prepare(`
  INSERT INTO requests (id, email, employeeName, currentSite, preferredSite, preferredShift, notes, status, submittedAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getRequestById = db.prepare(`SELECT * FROM requests WHERE id = ?`);
const getRequestsByStatus = db.prepare(`SELECT * FROM requests WHERE status = ? ORDER BY submittedAt DESC`);
const getAllRequests = db.prepare(`SELECT * FROM requests ORDER BY submittedAt DESC`);

const updateRequestStatus = db.prepare(`
  UPDATE requests 
  SET status = ?, updatedAt = ?, denialReason = ?
  WHERE id = ?
`);

const deleteDeniedRequests = db.prepare(`DELETE FROM requests WHERE status = 'denied'`);

const deleteOldApprovedRequests = db.prepare(
  `DELETE FROM requests WHERE status = 'approved' AND updatedAt < ?`
);

function withCorsHeaders(origin) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders
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
  const results = status 
    ? getRequestsByStatus.all(status)
    : getAllRequests.all();
  return jsonResponse(results, 200, corsHeaders);
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

  try {
    insertRequest.run(
      doc.id,
      doc.email,
      doc.employeeName,
      doc.currentSite,
      doc.preferredSite,
      doc.preferredShift,
      doc.notes,
      doc.status,
      doc.submittedAt,
      doc.updatedAt
    );
    return jsonResponse(doc, 201, corsHeaders);
  } catch (error) {
    console.error("Database insert failed:", error);
    return jsonResponse({ error: "Failed to create request" }, 500, corsHeaders);
  }
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

  const item = getRequestById.get(id);
  if (!item) {
    return jsonResponse({ error: "Request not found" }, 404, corsHeaders);
  }

  try {
    updateRequestStatus.run(
      newStatus,
      new Date().toISOString(),
      newStatus === "denied" ? denialReason.trim() : null,
      id
    );

    // Return updated item
    const updatedItem = getRequestById.get(id);
    return jsonResponse(updatedItem, 200, corsHeaders);
  } catch (error) {
    console.error("Database update failed:", error);
    return jsonResponse({ error: "Failed to update request" }, 500, corsHeaders);
  }
}

async function serveStatic(pathname) {
  const normalizedPath = pathname === "/" ? "app.html" : pathname.slice(1);
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

    // Debug logging
    console.log(`${method} ${pathname}`);

    try {
      if (pathname === "/api/requests/denied") {
        if (method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders });
        if (method === "DELETE") {
          const result = deleteDeniedRequests.run();
          return jsonResponse({ deleted: result.changes }, 200, corsHeaders);
        }
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
      }

      if (pathname === "/api/requests/approved/old") {
        if (method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders });
        if (method === "DELETE") {
          const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const result = deleteOldApprovedRequests.run(cutoff);
          return jsonResponse({ deleted: result.changes }, 200, corsHeaders);
        }
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
      }

      if (pathname === "/api/requests") {
        if (method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders });
        if (method === "GET") return await handleGetRequests(url, corsHeaders);
        if (method === "POST") return await handlePostRequests(request, corsHeaders);
        console.log(`Method ${method} not allowed for ${pathname}`);
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
