// server/cosmos.js
import { CosmosClient } from "@azure/cosmos";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.COSMOS_CONNECTION_STRING;
const databaseId = process.env.COSMOS_DB || "transferPortal";
const containerId = process.env.COSMOS_CONTAINER || "transferRequests";

if (!connectionString) {
  throw new Error(
    "Missing COSMOS_CONNECTION_STRING in environment. " +
      "Set it to your Azure Cosmos DB connection string."
  );
}

const client = new CosmosClient(connectionString);

let _database = null;
let _container = null;

/**
 * Create database + container if they don't exist.
 * Call this once at startup (already done in index.js).
 */
export async function ensureContainer() {
  // Create or get DB
  const { database } = await client.databases.createIfNotExists({
    id: databaseId
  });

  // Create or get container
  const { container } = await database.containers.createIfNotExists({
    id: containerId,
    partitionKey: {
      paths: ["/currentSite"], // partition by current site
      kind: "Hash"
    },
    indexingPolicy: {
      indexingMode: "consistent",
      // keep everything indexed by default
      includedPaths: [{ path: "/*" }],
      compositeIndexes: [
        // optimize for "WHERE status = @status ORDER BY submittedAt DESC"
        [
          { path: "/status", order: "ascending" },
          { path: "/submittedAt", order: "descending" }
        ]
      ]
    }
  });

  _database = database;
  _container = container;

  console.log(
    `Cosmos DB ready. Database: ${databaseId}, Container: ${containerId}`
  );
}

/**
 * Get the configured container. Throws if ensureContainer()
 * hasn't been called yet.
 */
export function getContainer() {
  if (!_container) {
    throw new Error(
      "Cosmos container not initialized. Call ensureContainer() at startup."
    );
  }
  return _container;
}
