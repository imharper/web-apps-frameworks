import dotenv from "dotenv";
import path from "node:path";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import type { AuthPayload, UserRole } from "@ticket-cabinet/shared";

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({
    path: path.resolve(__dirname, "../../../.env"),
  });
}
const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://127.0.0.1:4001";
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || "http://127.0.0.1:4002";
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || "http://127.0.0.1:4003";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const FRONTEND_REDUX_URL = process.env.FRONTEND_REDUX_URL || "http://localhost:3001";
const FRONTEND_MOBX_URL = process.env.FRONTEND_MOBX_URL || "http://localhost:3002";
const allowedOrigins = [
  FRONTEND_URL,
  FRONTEND_REDUX_URL,
  FRONTEND_MOBX_URL,
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8083",
  "http://localhost:8084",
];

interface AuthenticatedRequest extends express.Request {
  user?: AuthPayload;
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

function pickBody(req: express.Request): string | undefined {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  return req.body ? JSON.stringify(req.body) : undefined;
}

async function proxyRequest(req: express.Request, res: express.Response, targetUrl: string, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: pickBody(req),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return res.status(response.status).json(data);
  } catch {
    return res.status(502).json({ error: "Сервис временно недоступен" });
  }
}

function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Требуется Bearer токен" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return next();
  } catch {
    return res.status(401).json({ error: "Некорректный или просроченный токен" });
  }
}

function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: "Недостаточно прав" });
    }

    return next();
  };
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

app.post("/api/auth/register", (req, res) => {
  return proxyRequest(req, res, `${USER_SERVICE_URL}/users/register`);
});

app.post("/api/auth/login", (req, res) => {
  return proxyRequest(req, res, `${USER_SERVICE_URL}/users/login`);
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return proxyRequest(req, res, `${USER_SERVICE_URL}/users/me`);
});

app.get("/api/events", (req, res) => {
  return proxyRequest(req, res, `${EVENT_SERVICE_URL}/events`);
});

app.post("/api/events", requireAuth, requireRole("admin"), (req: AuthenticatedRequest, res) => {
  return proxyRequest(req, res, `${EVENT_SERVICE_URL}/events`, {
    "x-user-id": req.user!.sub,
    "x-user-role": req.user!.role,
  });
});

app.get("/api/bookings", requireAuth, (req: AuthenticatedRequest, res) => {
  return proxyRequest(req, res, `${BOOKING_SERVICE_URL}/bookings`, {
    "x-user-id": req.user!.sub,
    "x-user-role": req.user!.role,
  });
});

app.post("/api/bookings", requireAuth, requireRole("user"), (req: AuthenticatedRequest, res) => {
  return proxyRequest(req, res, `${BOOKING_SERVICE_URL}/bookings`, {
    "x-user-id": req.user!.sub,
    "x-user-role": req.user!.role,
  });
});

app.delete("/api/bookings/:id", requireAuth, requireRole("user"), (req: AuthenticatedRequest, res) => {
  return proxyRequest(req, res, `${BOOKING_SERVICE_URL}/bookings/${req.params.id}`, {
    "x-user-id": req.user!.sub,
    "x-user-role": req.user!.role,
  });
});

app.listen(PORT, () => {
  console.log(`[api-gateway] listening on :${PORT}`);
});
