import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import type { MicrofrontendProps } from "@shared";
import NotificationIsland from "../../frontend/src/NotificationIsland";
import { appStore } from "./store";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

const RemoteDashboard = observer(function RemoteDashboard(props: MicrofrontendProps) {
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    venue: "",
    capacity: 50,
  });
  const [qtyByEvent, setQtyByEvent] = useState<Record<string, number>>({});

  useEffect(() => {
    appStore.setSession(props);
    void appStore.bootstrap(true);
  }, [props]);

  const currentUser = appStore.currentUser ?? props.currentUser;

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    await appStore.createEvent(eventForm);
    setEventForm({
      title: "",
      description: "",
      startsAt: "",
      venue: "",
      capacity: 50,
    });
  }

  return (
    <div>
      <NotificationIsland
        error={appStore.error}
        info={appStore.info}
        onClearError={appStore.clearError}
        onClearInfo={appStore.clearInfo}
      />

      <section className="card">
        <h2>MobX Microfrontend</h2>
        <div className="profile-grid">
          <p>Текущий пользователь: {currentUser.name}</p>
          <p>Ближайшее мероприятие: {appStore.profileSummary.upcomingEvent}</p>
          <p>Всего бронирований: {appStore.profileSummary.totalBookings}</p>
          <p>Всего билетов: {appStore.profileSummary.totalTickets}</p>
        </div>
        {appStore.profileSummary.bookedEvents.length > 0 && (
          <p>Забронированные мероприятия: {appStore.profileSummary.bookedEvents.join(", ")}</p>
        )}
      </section>

      {appStore.isLoading && <p className="muted-text">Загрузка данных...</p>}

      {currentUser.role === "admin" && (
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
            <button type="submit" disabled={appStore.mutatingEvent}>
              Создать
            </button>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Доступные мероприятия</h2>
        <div className="events-grid">
          {appStore.events.map((event) => (
            <article key={event.id} className="event-card">
              <h3>{event.title}</h3>
              <p>{event.description || "Без описания"}</p>
              <p>Когда: {formatDate(event.startsAt)}</p>
              <p>Где: {event.venue}</p>
              <p>
                Свободно мест: <strong>{event.availableSeats}</strong> / {event.capacity}
              </p>
              <p>Моих билетов: {appStore.bookingsByEvent.get(event.id) || 0}</p>
              {currentUser.role === "user" ? (
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
                  <button
                    onClick={() => void appStore.createBooking({ eventId: event.id, quantity: qtyByEvent[event.id] || 1 })}
                    disabled={event.availableSeats <= 0 || appStore.mutatingBooking}
                  >
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
        {currentUser.role !== "user" ? (
          <p className="muted-text">Для администратора бронирование и отмена бронирования недоступны.</p>
        ) : appStore.bookings.length === 0 ? (
          <p>Бронирований пока нет</p>
        ) : (
          <ul className="booking-list">
            {appStore.bookings.map((booking) => (
              <li key={booking.id} className="booking-item">
                <div>
                  <strong>{appStore.events.find((item) => item.id === booking.eventId)?.title || booking.eventId}</strong>
                  <span> • Количество: {booking.quantity}</span>
                  <span> • Создано: {formatDate(booking.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void appStore.cancelBooking(booking.id)}
                  disabled={appStore.mutatingBooking}
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
});

export default RemoteDashboard;
