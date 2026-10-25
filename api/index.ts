import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "../server/routes";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

let initialized = false;
let initPromise: Promise<void> | null = null;

async function init() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      await registerRoutes(app);
      initialized = true;
    })();
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  await init();
  return app(req, res);
}
