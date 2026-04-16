import { useEffect, useMemo, useState } from "react";
import { Provider } from "react-redux";
import type { MicrofrontendProps } from "@shared";
import { clearAuth, setToken } from "./authSlice";
import { api, useCancelBookingMutation, useCreateBookingMutation, useCreateEventMutation, useGetBookingsQuery, useGetCurrentUserQuery, useGetEventsQuery } from "./api";
import { useAppDispatch } from "./hooks";
import NotificationIsland from "./NotificationIsland";
import { store } from "./store";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

function RemoteDashboardContent({ token, currentUser, onLogout }: MicrofrontendProps) {
  const dispatch = useAppDispatch();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    venue: "",
    capacity: 50,
  });
  const [qtyByEvent, setQtyByEvent] = useState<Record<string, number>>({});

  const [createEvent, createEventState] = useCreateEventMutation();
  const [createBooking, createBookingState] = useCreateBookingMutation();
  const [cancelBooking, cancelBookingState] = useCancelBookingMutation();

  useEffect(() => {
    dispatch(setToken(token));
    dispatch(api.util.upsertQueryData("getCurrentUser", undefined, currentUser));
  }, [currentUser, dispatch, token]);

  const userQuery = useGetCurrentUserQuery();
  const eventsQuery = useGetEventsQuery();
  const bookingsQuery = useGetBookingsQuery();

  const user = userQuery.data ?? currentUser;
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
    if (!userQuery.isError) {
      return;
    }

    dispatch(clearAuth());
    dispatch(api.util.resetApiState());
    onLogout();
  }, [dispatch, onLogout, userQuery.isError]);

  async function reserve(eventId: string) {
    if (user.role !== "user") {
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
    if (user.role !== "user") {
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

  return (
    <div>
      <NotificationIsland error={error} info={info} onClearError={() => setError("")} onClearInfo={() => setInfo("")} />

      <section className="card">
        <h2>Redux RTK Microfrontend</h2>
        <div className="profile-grid">
          <p>Текущий пользователь: {user.name}</p>
          <p>Ближайшее мероприятие: {profileSummary.upcomingEvent}</p>
          <p>Всего бронирований: {profileSummary.totalBookings}</p>
          <p>Всего билетов: {profileSummary.totalTickets}</p>
        </div>
        {profileSummary.bookedEvents.length > 0 && <p>Забронированные мероприятия: {profileSummary.bookedEvents.join(", ")}</p>}
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
              ) : (
                <p className="muted-text">Администратор может создавать мероприятия, но не бронировать их.</p>
              )}
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
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleCancelBooking(booking.id)}
                  disabled={cancelBookingState.isLoading}
                >
                  Отменить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function RemoteDashboard(props: MicrofrontendProps) {
  return (
    <Provider store={store}>
      <RemoteDashboardContent {...props} />
    </Provider>
  );
}
