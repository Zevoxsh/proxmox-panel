import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import vmRoutes from "./routes/vms.js";
import vmProvisionRoutes from "./routes/vm-provision.js";
import stripeRoutes from "./routes/stripe.js";
import gameRoutes from "./routes/game-servers.js";
import billingRoutes from "./routes/billing.js";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const corsOrigin = process.env.CORS_ORIGIN;
const originList = corsOrigin ? corsOrigin.split(",").map((o) => o.trim()) : [];

app.use("/stripe/webhook", express.raw({ type: "application/json" }));

app.use(
  cors({
    origin: (origin: string | undefined, cb) => {
      if (!origin) return cb(null, true);
      if (originList.length === 0 || originList.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/vms", vmRoutes);
app.use("/vms", vmProvisionRoutes);
app.use("/stripe", stripeRoutes);
app.use("/game-servers", gameRoutes);
app.use("/billing", billingRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("[server] error", err);
  res.status(500).json({ error: "Erreur serveur" });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on :${port}`);
});
