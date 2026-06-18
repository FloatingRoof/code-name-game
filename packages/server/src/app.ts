import cors from "cors";
import express, { type Express } from "express";
import { config } from "./config.js";

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  return app;
}
