import { getContainer } from "../shared/cosmosClient.js";

const VALID_STATUSES = ["received", "in-review", "approved", "denied"];

export default async function (context, req) {
  const container = await getContainer();

  // CORS
  const origin = req.headers.origin || "*";
  context.res = context.res || {};
  context.res.headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    context.res.status = 204;
    context.res.body = "";
    return;
  }

  if (req.method !== "PATCH") {
    context.res.status = 405;
    context.res.body = { error: "Method not allowed" };
    return;
  }

  const id = context.bindingData.id; // from route param
  const { status: newStatus, denialReason } = req.body || {};

  if (!VALID_STATUSES.includes(newStatus)) {
    context.res.status = 400;
    context.res.body = { error: "Invalid status value" };
    return;
  }

  if (newStatus === "denied" && (!denialReason || !denialReason.trim())) {
    context.res.status = 400;
    context.res.body = { error: "denialReason is required when denied" };
    return;
  }

  // Find item by id across partitions
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
    context.res.status = 404;
    context.res.body = { error: "Request not found" };
    return;
  }

  item.status = newStatus;
  item.updatedAt = new Date().toISOString();

  if (newStatus === "denied") item.denialReason = denialReason.trim();
  else delete item.denialReason;

  const partitionKey = item.currentSite;
  const { resource } = await container.item(item.id, partitionKey).replace(item);

  context.res.status = 200;
  context.res.body = resource;
}
