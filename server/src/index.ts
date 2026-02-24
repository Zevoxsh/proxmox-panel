import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer, WebSocket as WS, type RawData } from "ws";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import clientRoutes from "./routes/client.js";
import vmsRoutes from "./routes/vms.js";
import vmProvisionRoutes from "./routes/vm-provision.js";
import gameServersRoutes from "./routes/game-servers.js";
import stripeRoutes from "./routes/stripe.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const corsOriginEnv = process.env.CORS_ORIGIN || "http://localhost:3000";
const corsOrigins = corsOriginEnv
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: true, credentials: true }));
} else {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
}
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/stripe/webhook")) {
    return express.raw({ type: "application/json" })(req, res, next);
  }
  return express.json({ limit: "2mb" })(req, res, next);
});
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/client", clientRoutes);
app.use("/vms", vmsRoutes);
app.use("/vms", vmProvisionRoutes);
app.use("/game-servers", gameServersRoutes);
app.use("/stripe", stripeRoutes);

// WebSocket console proxy (Proxmox)
if (!globalThis.__consoleSessions) {
  globalThis.__consoleSessions = new Map();
}
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of globalThis.__consoleSessions.entries()) {
    if (session.expiresAt < now) globalThis.__consoleSessions.delete(token);
  }
}, 60_000);

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const match = req.url?.match(/^\/ws-console\/([0-9a-f-]+)$/i);
  if (!match) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    handleConsoleConnection(ws, match[1]);
  });
});

function handleConsoleConnection(clientWs: WS, token: string) {
  const sessions = globalThis.__consoleSessions as Map<string, any>;
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    clientWs.close(1008, "Invalid or expired token");
    return;
  }
  sessions.delete(token);

  const { proxmoxWsUrl, proxmoxAuthCookie, sslVerify } = session;
  const proxmoxWs = new WS(proxmoxWsUrl, {
    headers: { Cookie: `PVEAuthCookie=${proxmoxAuthCookie}` },
    rejectUnauthorized: sslVerify === true,
  });

  proxmoxWs.on("open", () => {
    clientWs.on("message", (data: RawData) => {
      if (proxmoxWs.readyState === WS.OPEN) proxmoxWs.send(data);
    });
  });

  proxmoxWs.on("message", (data: RawData) => {
    if (clientWs.readyState === WS.OPEN) clientWs.send(data);
  });

  proxmoxWs.on("close", (code: number, reason: Buffer) => clientWs.close(code, reason));
  proxmoxWs.on("error", (err: Error) => {
    // eslint-disable-next-line no-console
    console.error("[ws-proxy] Proxmox WS error:", err.message);
    clientWs.close(1011, "Proxy error");
  });

  clientWs.on("close", () => proxmoxWs.close());
  clientWs.on("error", (err: Error) => {
    // eslint-disable-next-line no-console
    console.error("[ws-proxy] Client WS error:", err.message);
    proxmoxWs.close();
  });
}

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on :${port}`);
});
