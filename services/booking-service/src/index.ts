import dotenv from "dotenv";
import path from "node:path";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { Pool } from "pg";
import type { Booking, CreateBookingDto, EventItem } from "@ticket-cabinet/shared";

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({
    path: path.resolve(__dirname, "../../../.env"),
  });
}
const app = express();
const PORT = Number(process.env.BOOKING_SERVICE_PORT || 4003);
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || "http://127.0.0.1:4002";
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({ connectionString: DATABASE_URL });

interface BookingRow {
  id: string;
  user_id: string;
  event_id: string;
  quantity: number;
  created_at: Date;
}

app.use(cors());
app.use(express.json());

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    quantity: row.quantity,
    createdAt: row.created_at.toISOString(),
  };
}

function ensureRegularUser(role: string | undefined): string | null {
  if (role === "admin") {
    return "Администратор не может создавать или отменять бронирования";
  }

  return null;
}

async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      event_id UUID NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings (user_id)
  `);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "booking-service" });
});

app.get("/bookings", async (req, res) => {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(401).json({ error: "Требуется пользователь" });
  }

  try {
    const query = await pool.query<BookingRow>(
      `
      SELECT id, user_id, event_id, quantity, created_at
      FROM bookings
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    return res.json(query.rows.map(toBooking));
  } catch (error) {
    console.error("[booking-service] list error", error);
    return res.status(500).json({ error: "Не удалось загрузить бронирования" });
  }
});

app.post("/bookings", async (req, res) => {
  const userId = req.header("x-user-id");
  const userRole = req.header("x-user-role");
  if (!userId) {
    return res.status(401).json({ error: "Требуется пользователь" });
  }

  const roleError = ensureRegularUser(userRole);
  if (roleError) {
    return res.status(403).json({ error: roleError });
  }

  const body = req.body as CreateBookingDto;
  if (!body?.eventId || !body?.quantity) {
    return res.status(400).json({ error: "eventId и quantity обязательны" });
  }

  if (!Number.isInteger(body.quantity) || body.quantity <= 0) {
    return res.status(400).json({ error: "quantity должен быть положительным целым числом" });
  }

  let reserveResponse: Response;
  try {
    reserveResponse = await fetch(`${EVENT_SERVICE_URL}/internal/events/${body.eventId}/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantity: body.quantity }),
    });
  } catch (error) {
    console.error("[booking-service] reserve call failed", error);
    return res.status(502).json({ error: "Сервис мероприятий временно недоступен" });
  }

  if (!reserveResponse.ok) {
    const error = (await reserveResponse.json()) as { error?: string };
    return res.status(reserveResponse.status).json({ error: error.error || "Ошибка резервирования мест" });
  }

  const reservedEvent = (await reserveResponse.json()) as EventItem;

  try {
    const query = await pool.query<BookingRow>(
      `
      INSERT INTO bookings (id, user_id, event_id, quantity)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, event_id, quantity, created_at
      `,
      [randomUUID(), userId, reservedEvent.id, body.quantity]
    );

    return res.status(201).json(toBooking(query.rows[0]));
  } catch (error) {
    try {
      await fetch(`${EVENT_SERVICE_URL}/internal/events/${body.eventId}/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: body.quantity }),
      });
    } catch (releaseError) {
      console.error("[booking-service] failed to release seats after insert error", releaseError);
    }

    console.error("[booking-service] create error", error);
    return res.status(500).json({ error: "Не удалось создать бронирование" });
  }
});

app.delete("/bookings/:id", async (req, res) => {
  const userId = req.header("x-user-id");
  const userRole = req.header("x-user-role");

  if (!userId) {
    return res.status(401).json({ error: "Требуется пользователь" });
  }

  const roleError = ensureRegularUser(userRole);
  if (roleError) {
    return res.status(403).json({ error: roleError });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const bookingQuery = await client.query<BookingRow>(
      `
      SELECT id, user_id, event_id, quantity, created_at
      FROM bookings
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      FOR UPDATE
      `,
      [req.params.id, userId]
    );

    const booking = bookingQuery.rows[0];
    if (!booking) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Бронирование не найдено" });
    }

    let releaseResponse: Response;
    try {
      releaseResponse = await fetch(`${EVENT_SERVICE_URL}/internal/events/${booking.event_id}/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: booking.quantity }),
      });
    } catch (error) {
      console.error("[booking-service] release call failed", error);
      await client.query("ROLLBACK");
      return res.status(502).json({ error: "Сервис мероприятий временно недоступен" });
    }

    if (!releaseResponse.ok) {
      const error = (await releaseResponse.json()) as { error?: string };
      await client.query("ROLLBACK");
      return res.status(releaseResponse.status).json({ error: error.error || "Ошибка освобождения мест" });
    }

    const deletedBooking = await client.query<BookingRow>(
      `
      DELETE FROM bookings
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, event_id, quantity, created_at
      `,
      [booking.id, userId]
    );

    await client.query("COMMIT");
    return res.json(toBooking(deletedBooking.rows[0]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and return the original failure.
    }

    console.error("[booking-service] cancel error", error);
    return res.status(500).json({ error: "Не удалось отменить бронирование" });
  } finally {
    client.release();
  }
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`[booking-service] listening on :${PORT}`);
    });
  } catch (error) {
    console.error("[booking-service] failed to start", error);
    process.exit(1);
  }
}

start();
