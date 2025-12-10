// server/routes/requests.js
import express from "express";
import crypto from "crypto";
import { getContainer } from "../cosmos.js";

const router = express.Router();

const VALID_STATUSES = ["received", "in-review", "approved", "denied"];

// Build a new request document
function buildRequestFromBody(body) {
  const now = new Date().toISOString();
  return {
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
}

// GET /api/requests?status=received
router.get("/", async (req, res) => {
  const status = req.query.status;
  const container = getContainer();

  try {
    let querySpec;

    if (status) {
      querySpec = {
        query:
          "SELECT * FROM c WHERE c.status = @status ORDER BY c.submittedAt DESC",
        parameters: [{ name: "@status", value: status }]
      };
    } else {
      querySpec = {
        query: "SELECT * FROM c ORDER BY c.submittedAt DESC"
      };
    }

    const { resources } = await container.items
      .query(querySpec, { enableCrossPartitionQuery: true })
      .fetchAll();

    res.json(resources);
  } catch (err) {
    console.error("Failed to list requests", err);
    res.status(500).json({ error: "Failed to list requests" });
  }
});

// POST /api/requests
router.post("/", async (req, res) => {
  const container = getContainer();

  try {
    const requestDoc = buildRequestFromBody(req.body);

    if (
      !requestDoc.email ||
      !requestDoc.currentSite ||
      !requestDoc.preferredSite ||
      !requestDoc.preferredShift
    ) {
      return res.status(400).json({
        error:
          "Missing required fields (email, currentSite, preferredSite, preferredShift)."
      });
    }

    const { resource } = await container.items.create(requestDoc);
    res.status(201).json(resource);
  } catch (err) {
    console.error("Failed to create request", err);
    res.status(500).json({ error: "Failed to create request" });
  }
});

// PATCH /api/requests/:id/status
router.patch("/:id/status", async (req, res) => {
  const container = getContainer();
  const { id } = req.params;
  const { status: newStatus, denialReason } = req.body;

  if (!VALID_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  // Require a reason when denying
  if (newStatus === "denied") {
    if (!denialReason || !denialReason.trim()) {
      return res
        .status(400)
        .json({ error: "denialReason is required when status is denied." });
    }
  }

  try {
    // Find the item by id across partitions
    const { resources } = await container.items
      .query(
        {
          query: "SELECT * FROM c WHERE c.id = @id",
          parameters: [{ name: "@id", value: id }]
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    const item = resources[0];
    if (!item) {
      return res.status(404).json({ error: "Request not found" });
    }

    item.status = newStatus;
    item.updatedAt = new Date().toISOString();

    if (newStatus === "denied") {
      item.denialReason = denialReason.trim();
    } else {
      // Optional: clear denialReason if they move it back out of denied
      delete item.denialReason;
    }

    const partitionKey = item.currentSite;
    const { resource } = await container.item(item.id, partitionKey).replace(item);
    res.json(resource);
  } catch (err) {
    console.error("Failed to update status", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
