import crypto from "node:crypto";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config();

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = new URL(".", import.meta.url).pathname.slice(1);
const publicDir = join(__dirname, "public");

const VALID_STATUSES = ["received", "in-review", "approved", "denied", "archived-approved", "archived-denied"];

// Initialize PostgreSQL connection pool
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
  database: process.env.PGDATABASE || "transfer_portal",
  ssl: process.env.PGHOST?.includes("azure") ? { rejectUnauthorized: false } : false
});

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        "employeeName" TEXT,
        "currentSite" TEXT NOT NULL,
        "preferredSite" TEXT NOT NULL,
        "preferredShift" TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'received',
        "denialReason" TEXT,
        "submittedAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_status ON requests(status)`);
    console.log("Database schema initialized");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  } finally {
    client.release();
  }
}

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.get("origin") || "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// GET /api/requests - Get all requests or filter by status
app.get("/api/requests", async (req, res) => {
  try {
    const status = req.query.status;
    let query = "SELECT * FROM requests";
    const params = [];

    if (status) {
      query += " WHERE status = $1";
      params.push(status);
    }

    query += " ORDER BY \"submittedAt\" DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch requests:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// POST /api/requests - Create a new request
app.post("/api/requests", async (req, res) => {
  try {
    const { email, employeeName, currentSite, preferredSite, preferredShift, notes } = req.body;

    if (!email || !currentSite || !preferredSite || !preferredShift) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO requests (id, email, "employeeName", "currentSite", "preferredSite", "preferredShift", notes, status, "submittedAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await pool.query(query, [
      id,
      email.trim().toLowerCase(),
      employeeName?.trim() || "",
      currentSite,
      preferredSite,
      preferredShift,
      notes?.trim() || "",
      "received",
      now,
      now
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Database insert failed:", error);
    res.status(500).json({ error: "Failed to create request" });
  }
});

// PATCH /api/requests/:id/status - Update request status
app.patch("/api/requests/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus, denialReason } = req.body;

    if (!VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    if (newStatus === "denied" && (!denialReason || !denialReason.trim())) {
      return res.status(400).json({
        error: "denialReason is required when denied"
      });
    }

    // Check if request exists
    const checkResult = await pool.query("SELECT * FROM requests WHERE id = $1", [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const query = `
      UPDATE requests 
      SET status = $1, "updatedAt" = $2, "denialReason" = $3
      WHERE id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [
      newStatus,
      new Date().toISOString(),
      newStatus === "denied" ? denialReason.trim() : null,
      id
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Database update failed:", error);
    res.status(500).json({ error: "Failed to update request" });
  }
});

// POST /api/requests/denied/archive - Archive all denied requests
app.post("/api/requests/denied/archive", async (req, res) => {
  try {
    const now = new Date().toISOString();
    const result = await pool.query(
      "UPDATE requests SET status = 'archived-denied', \"updatedAt\" = $1 WHERE status = 'denied'",
      [now]
    );
    res.json({ archived: result.rowCount });
  } catch (error) {
    console.error("Database archive failed:", error);
    res.status(500).json({ error: "Failed to archive requests" });
  }
});

// POST /api/requests/approved/archive - Archive all approved requests
app.post("/api/requests/approved/archive", async (req, res) => {
  try {
    const now = new Date().toISOString();
    const result = await pool.query(
      "UPDATE requests SET status = 'archived-approved', \"updatedAt\" = $1 WHERE status = 'approved'",
      [now]
    );
    res.json({ archived: result.rowCount });
  } catch (error) {
    console.error("Database archive failed:", error);
    res.status(500).json({ error: "Failed to archive requests" });
  }
});

// GET /api/requests/search - Search requests by email
app.get("/api/requests/search", async (req, res) => {
  try {
    const { email, status } = req.query;
    if (!email) {
      return res.status(400).json({ error: "Email query parameter is required" });
    }
    let query = "SELECT * FROM requests WHERE LOWER(email) LIKE $1";
    const params = [`%${email.trim().toLowerCase()}%`];

    if (status) {
      query += " AND status = $2";
      params.push(status);
    }

    query += " ORDER BY \"submittedAt\" DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Search failed:", error);
    res.status(500).json({ error: "Failed to search requests" });
  }
});

// Serve static files
app.use(express.static(publicDir));

// Fallback for SPA routing
app.use((req, res, next) => {
  const normalizedPath = req.path === "/" ? "app.html" : req.path.slice(1);
  const candidate = normalize(join(publicDir, normalizedPath));

  if (!candidate.startsWith(publicDir)) {
    return res.status(403).send("Forbidden");
  }

  const filePath = fs.existsSync(candidate) ? candidate : join(publicDir, "app.html");

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("Not found");
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await pool.end();
  process.exit(0);
});

// Start server
async function start() {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      console.log(`Transfer Portal server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
