import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@shared";
import { clearAuth, setToken } from "./authSlice";
import { api, useCancelBookingMutation, useCreateBookingMutation, useCreateEventMutation, useGetBookingsQuery, useGetCurrentUserQuery, useGetEventsQuery, useLoginMutation, useRegisterMutation } from "./api";
import { useAppDispatch, useAppSelector } from "./hooks";
import NotificationIsland from "./NotificationIsland";

type AuthMode = "login" | "register";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

export default function App() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
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

  const [login, loginState] = useLoginMutation();
  const [register, registerState] = useRegisterMutation();
  const [createEvent, createEventState] = useCreateEventMutation();
  const [createBooking, createBookingState] = useCreateBookingMutation();
  const [cancelBooking, cancelBookingState] = useCancelBookingMutation();

  const userQuery = useGetCurrentUserQuery(undefined, { skip: !token });
  const eventsQuery = useGetEventsQuery();
  const bookingsQuery = useGetBookingsQuery(undefined, { skip: !token });

  const user = userQuery.data ?? null;
  const events = eventsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];

  const bookingsByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of bookings) {
      map.set(booking.eventId, (map.get(booking.eventId) || 0) + booking.quantity);
    }
    return map;
  }, [bookings]);

  const profileSummary = useMemo(() => {
    const bookedEvents = bookings
      .map((booking) => events.find((item) => item.id === booking.eventId)?.title)
      .filter((title): title is string => Boolean(title));
    const upcomingEvent = events[0]?.title || "Нет доступных мероприятий";

    return {
      totalBookings: bookings.length,
      totalTickets: bookings.reduce((sum, booking) => sum + booking.quantity, 0),
      bookedEvents,
      upcomingEvent,
    };
  }, [bookings, events]);

  useEffect(() => {
    if (!token || !userQuery.isError) {
      return;
    }

    dispatch(clearAuth());
    dispatch(api.util.resetApiState());
    setError("Сессия истекла. Выполните вход заново.");
  }, [dispatch, token, userQuery.isError]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    try {
      const response =
        authMode === "login"
          ? await login({ email: authForm.email, password: authForm.password }).unwrap()
          : await register({
              email: authForm.email,
              password: authForm.password,
              name: authForm.name,
              role: authForm.role,
            }).unwrap();

      dispatch(setToken(response.token));
      dispatch(api.util.upsertQueryData("getCurrentUser", undefined, response.user));
      setInfo(authMode === "login" ? "Вход выполнен" : "Регистрация выполнена");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка аутентификации");
    }
  }

  function logout() {
    dispatch(clearAuth());
    dispatch(api.util.resetApiState());
    setError("");
    setInfo("Вы вышли из системы");
  }

  async function reserve(eventId: string) {
    if (!token || user?.role !== "user") {
      setError("Бронирование доступно только пользователю");
      return;
    }

    try {
      await createBooking({ eventId, quantity: qtyByEvent[eventId] || 1 }).unwrap();
      setInfo("Бронирование успешно создано");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка бронирования");
    }
  }

  async function handleCancelBooking(bookingId: string) {
    if (!token || user?.role !== "user") {
      setError("Отмена бронирования доступна только пользователю");
      return;
    }

    try {
      await cancelBooking(bookingId).unwrap();
      setInfo("Бронирование отменено");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отмены бронирования");
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    try {
      await createEvent(eventForm).unwrap();
      setEventForm({
        title: "",
        description: "",
        startsAt: "",
        venue: "",
        capacity: 50,
      });
      setInfo("Мероприятие создано");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания мероприятия");
    }
  }

  if (!token || !user) {
    return (
      <main className="auth-page">
        <NotificationIsland error={error} info={info} onClearError={() => setError("")} onClearInfo={() => setInfo("")} />
        <section className="card auth-card">
          <h1>Ticket Cabinet Redux</h1>

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
            <button type="submit" disabled={loginState.isLoading || registerState.isLoading}>
              {authMode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>

        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <NotificationIsland error={error} info={info} onClearError={() => setError("")} onClearInfo={() => setInfo("")} />
      <header className="topbar card">
        <div>
          <h1>Личный кабинет Redux</h1>
          <p>
            {user.name} ({user.email}) • роль: <strong>{user.role}</strong>
          </p>
        </div>
        <button onClick={logout}>Выйти</button>
      </header>

      <section className="card">
        <h2>Профиль</h2>
        <div className="profile-grid">
          <p>Ближайшее мероприятие: {profileSummary.upcomingEvent}</p>
          <p>Всего бронирований: {profileSummary.totalBookings}</p>
          <p>Всего билетов: {profileSummary.totalTickets}</p>
        </div>
      </section>

      {(eventsQuery.isLoading || userQuery.isLoading || bookingsQuery.isLoading) && <p className="muted-text">Загрузка данных...</p>}
      {user.role === "admin" && (
        <section className="card">
          <h2>Создать мероприятие</h2>
          <form onSubmit={handleCreateEvent} className="grid-form">
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
            <button type="submit" disabled={createEventState.isLoading}>
              Создать
            </button>
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
              {user.role === "user" ? (
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
                  <button onClick={() => reserve(event.id)} disabled={event.availableSeats <= 0 || createBookingState.isLoading}>
                    Забронировать
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Мои бронирования</h2>
        {user.role !== "user" ? (
          <p className="muted-text">Для администратора бронирование и отмена бронирования недоступны.</p>
        ) : bookings.length === 0 ? (
          <p>Бронирований пока нет</p>
        ) : (
          <ul className="booking-list">
            {bookings.map((booking) => (
              <li key={booking.id} className="booking-item">
                <div>
                  <strong>{events.find((item) => item.id === booking.eventId)?.title || booking.eventId}</strong>
                  <span> • Количество: {booking.quantity}</span>
                  <span> • Создано: {formatDate(booking.createdAt)}</span>
                </div>
                <button type="button" className="secondary-button" onClick={() => handleCancelBooking(booking.id)} disabled={cancelBookingState.isLoading}>
                  Отменить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
