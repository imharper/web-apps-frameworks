import dotenv from "dotenv";
import path from "node:path";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { Pool } from "pg";
import type { CreateEventDto, EventItem } from "@ticket-cabinet/shared";

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({
    path: path.resolve(__dirname, "../../../.env"),
  });
}

const app = express();
const PORT = 4002;
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({ connectionString: DATABASE_URL });

interface EventRow {
  id: string;
  title: string;
  description: string;
  starts_at: Date;
  venue: string;
  capacity: number;
  available_seats: number;
  created_by: string;
}

app.use(cors());
app.use(express.json());

function toEvent(row: EventRow): EventItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at.toISOString(),
    venue: row.venue,
    capacity: row.capacity,
    availableSeats: row.available_seats,
    createdBy: row.created_by,
  };
}

async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      starts_at TIMESTAMPTZ NOT NULL,
      venue TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const countResult = await pool.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM events");
  const total = Number(countResult.rows[0]?.total || "0");
  if (total > 0) {
    return;
  }

  const now = Date.now();
  const seedRows: EventRow[] = [
    {
      id: randomUUID(),
      title: "Tech Meetup 2026",
      description: "Встреча разработчиков и продуктовых команд",
      starts_at: new Date(now + 1000 * 60 * 60 * 24 * 7),
      venue: "Москва, Кластер Ломоносов",
      capacity: 150,
      available_seats: 150,
      created_by: randomUUID(),
    },
    {
      id: randomUUID(),
      title: "Jazz Evening",
      description: "Концерт живой джазовой музыки",
      starts_at: new Date(now + 1000 * 60 * 60 * 24 * 12),
      venue: "Санкт-Петербург, Music Hall",
      capacity: 80,
      available_seats: 80,
      created_by: randomUUID(),
    },
  ];

  for (const item of seedRows) {
    await pool.query(
      `
      INSERT INTO events (id, title, description, starts_at, venue, capacity, available_seats, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [item.id, item.title, item.description, item.starts_at, item.venue, item.capacity, item.available_seats, item.created_by]
    );
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "event-service" });
});

app.get("/events", async (_req, res) => {
  try {
    const query = await pool.query<EventRow>(
      `
      SELECT id, title, description, starts_at, venue, capacity, available_seats, created_by
      FROM events
      ORDER BY starts_at ASC
      `
    );

    return res.json(query.rows.map(toEvent));
  } catch (error) {
    console.error("[event-service] list error", error);
    return res.status(500).json({ error: "Не удалось загрузить мероприятия" });
  }
});

app.get("/events/:id", async (req, res) => {
  try {
    const query = await pool.query<EventRow>(
      `
      SELECT id, title, description, starts_at, venue, capacity, available_seats, created_by
      FROM events
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    const row = query.rows[0];
    if (!row) {
      return res.status(404).json({ error: "Мероприятие не найдено" });
    }

    return res.json(toEvent(row));
  } catch (error) {
    console.error("[event-service] get by id error", error);
    return res.status(500).json({ error: "Не удалось загрузить мероприятие" });
  }
});

app.post("/events", async (req, res) => {
  const role = req.header("x-user-role");
  const userId = req.header("x-user-id");

  if (role !== "admin") {
    return res.status(403).json({ error: "Только администратор может создавать мероприятия" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Требуется пользователь" });
  }

  const body = req.body as CreateEventDto;
  if (!body?.title || !body?.startsAt || !body?.venue || !body?.capacity) {
    return res.status(400).json({ error: "title, startsAt, venue и capacity обязательны" });
  }

  if (!Number.isInteger(body.capacity) || body.capacity <= 0) {
    return res.status(400).json({ error: "capacity должен быть положительным целым числом" });
  }

  try {
    const query = await pool.query<EventRow>(
      `
      INSERT INTO events (id, title, description, starts_at, venue, capacity, available_seats, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
      RETURNING id, title, description, starts_at, venue, capacity, available_seats, created_by
      `,
      [randomUUID(), body.title, body.description || "", body.startsAt, body.venue, body.capacity, userId]
    );

    return res.status(201).json(toEvent(query.rows[0]));
  } catch (error) {
    console.error("[event-service] create error", error);
    return res.status(500).json({ error: "Не удалось создать мероприятие" });
  }
});

app.post("/internal/events/:id/reserve", async (req, res) => {
  const quantity = Number(req.body?.quantity || 0);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "quantity должен быть положительным целым числом" });
  }

  try {
    const reserve = await pool.query<EventRow>(
      `
      UPDATE events
      SET available_seats = available_seats - $1
      WHERE id = $2 AND available_seats >= $1
      RETURNING id, title, description, starts_at, venue, capacity, available_seats, created_by
      `,
      [quantity, req.params.id]
    );

    if (reserve.rows.length > 0) {
      return res.json(toEvent(reserve.rows[0]));
    }

    const exists = await pool.query<{ id: string }>("SELECT id FROM events WHERE id = $1 LIMIT 1", [req.params.id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: "Мероприятие не найдено" });
    }

    return res.status(409).json({ error: "Недостаточно свободных мест" });
  } catch (error) {
    console.error("[event-service] reserve error", error);
    return res.status(500).json({ error: "Не удалось зарезервировать места" });
  }
});

app.post("/internal/events/:id/release", async (req, res) => {
  const quantity = Number(req.body?.quantity || 0);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "quantity должен быть положительным целым числом" });
  }

  try {
    const release = await pool.query<EventRow>(
      `
      UPDATE events
      SET available_seats = LEAST(capacity, available_seats + $1)
      WHERE id = $2
      RETURNING id, title, description, starts_at, venue, capacity, available_seats, created_by
      `,
      [quantity, req.params.id]
    );

    if (release.rows.length === 0) {
      return res.status(404).json({ error: "Мероприятие не найдено" });
    }

    return res.json(toEvent(release.rows[0]));
  } catch (error) {
    console.error("[event-service] release error", error);
    return res.status(500).json({ error: "Не удалось освободить места" });
  }
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`[event-service] listening on :${PORT}`);
    });
  } catch (error) {
    console.error("[event-service] failed to start", error);
    process.exit(1);
  }
}

start();
