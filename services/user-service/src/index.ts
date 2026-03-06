import dotenv from "dotenv";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import type { AuthPayload, AuthResponse, LoginDto, RegisterDto, User, UserRole } from "@ticket-cabinet/shared";

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({
    path: path.resolve(__dirname, "../../../.env"),
  });
}
const app = express();
const PORT = Number(process.env.USER_SERVICE_PORT || 4001);
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({ connectionString: DATABASE_URL });

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  created_at: Date;
}

app.use(cors());
app.use(express.json());

function signToken(user: User): string {
  const payload: AuthPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
}

function parseRole(value: string | undefined): UserRole {
  return value === "admin" ? "admin" : "user";
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  };
}

async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "user-service" });
});

app.post("/users/register", async (req, res) => {
  const body = req.body as RegisterDto;

  if (!body?.email || !body?.password || !body?.name) {
    return res.status(400).json({ error: "email, password и name обязательны" });
  }

  const id = randomUUID();
  const email = body.email.trim().toLowerCase();
  const name = body.name.trim();
  const role = parseRole(body.role);
  const passwordHash = await bcrypt.hash(body.password, 10);

  try {
    const query = await pool.query<UserRow>(
      `
      INSERT INTO users (id, email, name, role, password_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, role, password_hash, created_at
      `,
      [id, email, name, role, passwordHash]
    );

    const user = toUser(query.rows[0]);
    const response: AuthResponse = {
      token: signToken(user),
      user,
    };

    return res.status(201).json(response);
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return res.status(409).json({ error: "Пользователь уже существует" });
    }

    console.error("[user-service] register error", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервиса пользователей" });
  }
});

app.post("/users/login", async (req, res) => {
  const body = req.body as LoginDto;

  if (!body?.email || !body?.password) {
    return res.status(400).json({ error: "email и password обязательны" });
  }

  try {
    const query = await pool.query<UserRow>(
      `
      SELECT id, email, name, role, password_hash, created_at
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [body.email.trim().toLowerCase()]
    );

    const existing = query.rows[0];
    if (!existing) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const passwordMatch = await bcrypt.compare(body.password, existing.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const user = toUser(existing);
    const response: AuthResponse = {
      token: signToken(user),
      user,
    };

    return res.json(response);
  } catch (error) {
    console.error("[user-service] login error", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервиса пользователей" });
  }
});

app.get("/users/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Требуется Bearer токен" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const query = await pool.query<UserRow>(
      `
      SELECT id, email, name, role, password_hash, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [payload.sub]
    );

    const row = query.rows[0];
    if (!row) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    return res.json(toUser(row));
  } catch {
    return res.status(401).json({ error: "Некорректный или просроченный токен" });
  }
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`[user-service] listening on :${PORT}`);
    });
  } catch (error) {
    console.error("[user-service] failed to start", error);
    process.exit(1);
  }
}

start();
