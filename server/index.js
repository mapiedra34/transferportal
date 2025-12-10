import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import requestsRouter from "./routes/requests.js";
import { ensureContainer } from "./cosmos.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/requests", requestsRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, async () => {
  console.log(`API listening on http://localhost:${port}`);
  try {
    await ensureContainer();
    console.log("Cosmos DB ready");
  } catch (err) {
    console.error("Failed to ensure Cosmos resources", err);
  }
});
