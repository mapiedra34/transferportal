import { CosmosClient } from "@azure/cosmos";

const databaseId = process.env.COSMOS_DB || "transferPortal";
const containerId = process.env.COSMOS_CONTAINER || "transferRequests";

let containerCache = null;

export async function getContainer() {
  if (containerCache) return containerCache;

  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("Missing COSMOS_CONNECTION_STRING");
  }

  const client = new CosmosClient(connectionString);

  const { database } = await client.databases.createIfNotExists({ id: databaseId });

  const { container } = await database.containers.createIfNotExists({
    id: containerId,
    partitionKey: { paths: ["/currentSite"], kind: "Hash" }
  });

  containerCache = container;
  return containerCache;
}
