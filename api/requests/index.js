import crypto from "crypto";
import { getContainer } from "../shared/cosmosClient.js";

export default async function (context, req) {
  const container = await getContainer();

  // CORS (basic)
  const origin = req.headers.origin || "*";
  context.res = context.res || {};
  context.res.headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    context.res.status = 204;
    context.res.body = "";
    return;
  }

  if (req.method === "GET") {
    const status = req.query.status;

    const querySpec = status
      ? {
          query: "SELECT * FROM c WHERE c.status = @status ORDER BY c.submittedAt DESC",
          parameters: [{ name: "@status", value: status }]
        }
      : { query: "SELECT * FROM c ORDER BY c.submittedAt DESC" };

    const { resources } = await container.items
      .query(querySpec, { enableCrossPartitionQuery: true })
      .fetchAll();

    context.res.status = 200;
    context.res.body = resources;
    return;
  }

  if (req.method === "POST") {
    const now = new Date().toISOString();
    const body = req.body || {};

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
      context.res.status = 400;
      context.res.body = { error: "Missing required fields." };
      return;
    }

    const { resource } = await container.items.create(doc);
    context.res.status = 201;
    context.res.body = resource;
    return;
  }

  context.res.status = 405;
  context.res.body = { error: "Method not allowed" };
}
