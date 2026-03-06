import { useEffect, useMemo, useState } from "react";
import type { Booking, EventItem, User, UserRole } from "@shared";
import { api } from "./api";

const TOKEN_STORAGE_KEY = "ticket_cabinet_token";

type AuthMode = "login" | "register";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "user" as UserRole,
  });

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    venue: "",
    capacity: 50,
  });

  const [qtyByEvent, setQtyByEvent] = useState<Record<string, number>>({});

  const bookingsByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of bookings) {
      map.set(booking.eventId, (map.get(booking.eventId) || 0) + booking.quantity);
    }
    return map;
  }, [bookings]);

  async function loadDashboard(currentToken: string) {
    const [loadedEvents, loadedBookings] = await Promise.all([api.getEvents(), api.getBookings(currentToken)]);
    setEvents(loadedEvents);
    setBookings(loadedBookings);
  }

  useEffect(() => {
    async function bootstrap() {
      if (!token) {
        setUser(null);
        setEvents([]);
        setBookings([]);
        return;
      }

      try {
        const me = await api.me(token);
        setUser(me);
        await loadDashboard(token);
      } catch (e) {
        setToken(null);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setError(e instanceof Error ? e.message : "Ошибка авторизации");
      }
    }

    bootstrap();
  }, [token]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    try {
      const response =
        authMode === "login"
          ? await api.login({ email: authForm.email, password: authForm.password })
          : await api.register({
              email: authForm.email,
              password: authForm.password,
              name: authForm.name,
              role: authForm.role,
            });

      setToken(response.token);
      setUser(response.user);
      localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
      setInfo(authMode === "login" ? "Вход выполнен" : "Регистрация выполнена");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка аутентификации");
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setError("");
    setInfo("Вы вышли из системы");
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  async function reserve(eventId: string) {
    if (!token) {
      return;
    }

    const quantity = qtyByEvent[eventId] || 1;

    try {
      await api.createBooking({ eventId, quantity }, token);
      await loadDashboard(token);
      setInfo("Бронирование успешно создано");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка бронирования");
    }
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      return;
    }

    try {
      await api.createEvent(eventForm, token);
      setEventForm({
        title: "",
        description: "",
        startsAt: "",
        venue: "",
        capacity: 50,
      });
      setEvents(await api.getEvents());
      setInfo("Мероприятие создано");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания мероприятия");
    }
  }

  if (!token || !user) {
    return (
      <main className="auth-page">
        <section className="card auth-card">
          <h1>Ticket Cabinet</h1>
          <p>Личный кабинет системы бронирования билетов</p>

          <div className="tabs">
            <button onClick={() => setAuthMode("login")} className={authMode === "login" ? "active" : ""}>
              Вход
            </button>
            <button onClick={() => setAuthMode("register")} className={authMode === "register" ? "active" : ""}>
              Регистрация
            </button>
          </div>

          <form onSubmit={submitAuth} className="stack">
            {authMode === "register" && (
              <>
                <input
                  placeholder="Имя"
                  value={authForm.name}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <select value={authForm.role} onChange={(e) => setAuthForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}>
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </>
            )}

            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={authForm.password}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <button type="submit">{authMode === "login" ? "Войти" : "Создать аккаунт"}</button>
          </form>

          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar card">
        <div>
          <h1>Личный кабинет</h1>
          <p>
            {user.name} ({user.email}) • роль: <strong>{user.role}</strong>
          </p>
        </div>
        <button onClick={logout}>Выйти</button>
      </header>

      {error && <p className="error card">{error}</p>}
      {info && <p className="info card">{info}</p>}

      {user.role === "admin" && (
        <section className="card">
          <h2>Создать мероприятие</h2>
          <form onSubmit={createEvent} className="grid-form">
            <input
              placeholder="Название"
              value={eventForm.title}
              onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
            <input
              type="datetime-local"
              value={eventForm.startsAt ? new Date(eventForm.startsAt).toISOString().slice(0, 16) : ""}
              onChange={(e) =>
                setEventForm((prev) => ({
                  ...prev,
                  startsAt: e.target.value ? new Date(e.target.value).toISOString() : "",
                }))
              }
              required
            />
            <input
              placeholder="Площадка"
              value={eventForm.venue}
              onChange={(e) => setEventForm((prev) => ({ ...prev, venue: e.target.value }))}
              required
            />
            <input
              type="number"
              min={1}
              placeholder="Вместимость"
              value={eventForm.capacity}
              onChange={(e) => setEventForm((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
              required
            />
            <textarea
              placeholder="Описание"
              value={eventForm.description}
              onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <button type="submit">Создать</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Доступные мероприятия</h2>
        <div className="events-grid">
          {events.map((event) => (
            <article key={event.id} className="event-card">
              <h3>{event.title}</h3>
              <p>{event.description || "Без описания"}</p>
              <p>Когда: {formatDate(event.startsAt)}</p>
              <p>Где: {event.venue}</p>
              <p>
                Свободно мест: <strong>{event.availableSeats}</strong> / {event.capacity}
              </p>
              <p>Моих билетов: {bookingsByEvent.get(event.id) || 0}</p>
              <div className="booking-controls">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, event.availableSeats)}
                  value={qtyByEvent[event.id] || 1}
                  onChange={(e) =>
                    setQtyByEvent((prev) => ({
                      ...prev,
                      [event.id]: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                />
                <button onClick={() => reserve(event.id)} disabled={event.availableSeats <= 0}>
                  Забронировать
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Мои бронирования</h2>
        {bookings.length === 0 ? (
          <p>Бронирований пока нет</p>
        ) : (
          <ul className="booking-list">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <strong>{events.find((item) => item.id === booking.eventId)?.title || booking.eventId}</strong>
                <span> • Количество: {booking.quantity}</span>
                <span> • Создано: {formatDate(booking.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
