import { makeAutoObservable, runInAction } from "mobx";
import type {
  AuthResponse,
  Booking,
  CreateBookingDto,
  CreateEventDto,
  EventItem,
  LoginDto,
  RegisterDto,
  User,
} from "@shared";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_STORAGE_KEY = "ticket_cabinet_mobx_token";
const CACHE_TTL_MS = 60_000;

type CacheKey = "user" | "events" | "bookings";

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

class AppStore {
  token = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_STORAGE_KEY);
  currentUser: User | null = null;
  events: EventItem[] = [];
  bookings: Booking[] = [];
  error = "";
  info = "";
  loadingAuth = false;
  loadingUser = false;
  loadingEvents = false;
  loadingBookings = false;
  mutatingBooking = false;
  mutatingEvent = false;
  private cache: Record<CacheKey, number> = {
    user: 0,
    events: 0,
    bookings: 0,
  };

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isLoading() {
    return this.loadingAuth || this.loadingUser || this.loadingEvents || this.loadingBookings;
  }

  get bookingsByEvent() {
    const map = new Map<string, number>();
    for (const booking of this.bookings) {
      map.set(booking.eventId, (map.get(booking.eventId) || 0) + booking.quantity);
    }
    return map;
  }

  get profileSummary() {
    const bookedEvents = this.bookings
      .map((booking) => this.events.find((item) => item.id === booking.eventId)?.title)
      .filter((title): title is string => Boolean(title));

    return {
      totalBookings: this.bookings.length,
      totalTickets: this.bookings.reduce((sum, booking) => sum + booking.quantity, 0),
      upcomingEvent: this.events[0]?.title || "Нет доступных мероприятий",
      bookedEvents,
    };
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  clearAuth() {
    this.token = null;
    this.currentUser = null;
    this.bookings = [];
    this.error = "";
    this.info = "";
    this.cache.user = 0;
    this.cache.bookings = 0;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  private isFresh(key: CacheKey) {
    return Date.now() - this.cache[key] < CACHE_TTL_MS;
  }

  private touch(key: CacheKey) {
    this.cache[key] = Date.now();
  }

  private resetMessage() {
    this.error = "";
    this.info = "";
  }

  clearError() {
    this.error = "";
  }

  clearInfo() {
    this.info = "";
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new ApiRequestError(data?.error || "Ошибка запроса", response.status);
    }

    return data as T;
  }

  async bootstrap(force = false) {
    await this.loadEvents(force);

    if (!this.token) {
      return;
    }

    try {
      await Promise.all([this.loadCurrentUser(force), this.loadBookings(force)]);
    } catch {
      // Individual loaders already set state and error.
    }
  }

  async loadCurrentUser(force = false) {
    if (!this.token) {
      runInAction(() => {
        this.currentUser = null;
      });
      return;
    }

    if (!force && this.currentUser && this.isFresh("user")) {
      return;
    }

    runInAction(() => {
      this.loadingUser = true;
    });

    try {
      const user = await this.request<User>("/auth/me");
      runInAction(() => {
        this.currentUser = user;
        this.touch("user");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка загрузки пользователя";
      runInAction(() => {
        this.error = message;
      });
      if (error instanceof ApiRequestError && error.status === 401) {
        runInAction(() => {
          this.clearAuth();
          this.error = "Сессия истекла. Выполните вход заново.";
        });
      }
      throw error;
    } finally {
      runInAction(() => {
        this.loadingUser = false;
      });
    }
  }

  async loadEvents(force = false) {
    if (!force && this.events.length > 0 && this.isFresh("events")) {
      return;
    }

    runInAction(() => {
      this.loadingEvents = true;
    });

    try {
      const events = await this.request<EventItem[]>("/events", { method: "GET" });
      runInAction(() => {
        this.events = events;
        this.touch("events");
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Ошибка загрузки мероприятий";
      });
      throw error;
    } finally {
      runInAction(() => {
        this.loadingEvents = false;
      });
    }
  }

  async loadBookings(force = false) {
    if (!this.token) {
      runInAction(() => {
        this.bookings = [];
      });
      return;
    }

    if (!force && this.isFresh("bookings")) {
      return;
    }

    runInAction(() => {
      this.loadingBookings = true;
    });

    try {
      const bookings = await this.request<Booking[]>("/bookings", { method: "GET" });
      runInAction(() => {
        this.bookings = bookings;
        this.touch("bookings");
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Ошибка загрузки бронирований";
      });
      throw error;
    } finally {
      runInAction(() => {
        this.loadingBookings = false;
      });
    }
  }

  async login(payload: LoginDto) {
    this.resetMessage();
    this.loadingAuth = true;

    try {
      const response = await this.request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      runInAction(() => {
        this.setToken(response.token);
        this.currentUser = response.user;
        this.touch("user");
        this.info = "Вход выполнен";
      });

      await Promise.all([this.loadEvents(true), this.loadBookings(true)]);
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Ошибка аутентификации";
      });
      throw error;
    } finally {
      runInAction(() => {
        this.loadingAuth = false;
      });
    }
  }

  async register(payload: RegisterDto) {
    this.resetMessage();
    this.loadingAuth = true;

    try {
      const response = await this.request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      runInAction(() => {
        this.setToken(response.token);
        this.currentUser = response.user;
        this.touch("user");
        this.info = "Регистрация выполнена";
      });

      await Promise.all([this.loadEvents(true), this.loadBookings(true)]);
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Ошибка регистрации";
      });
      throw error;
    } finally {
      runInAction(() => {
        this.loadingAuth = false;
      });
    }
  }

  logout() {
    this.clearAuth();
    this.info = "Вы вышли из системы";
    void this.loadEvents(true);
  }

  async createEvent(payload: CreateEventDto) {
    this.resetMessage();
    this.mutatingEvent = true;

    try {
      await this.request<EventItem>("/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      runInAction(() => {
        this.cache.events = 0;
        this.info = "Мероприятие создано";
      });
      await this.loadEvents(true);
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Ошибка создания мероприятия";
      });
      throw error;
    } finally {
      runInAction(() => {
        this.mutatingEvent = false;
      });
    }
  }

  async createBooking(payload: CreateBookingDto) {
    if (this.currentUser?.role !== "user") {
      this.error = "Бронирование доступно только пользователю";
      return;
    }

    this.resetMessage();
    this.mutatingBooking = true;

    try {
      await this.request<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      runInAction(() => {
        this.cache.events = 0;
        this.cache.bookings = 0;
        this.info = "Бронирование успешно создано";
      });
      await Promise.all([this.loadEvents(true), this.loadBookings(true)]);
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Ошибка бронирования";
      });
      throw error;
    } finally {
      runInAction(() => {
        this.mutatingBooking = false;
      });
    }
  }

  async cancelBooking(bookingId: string) {
    if (this.currentUser?.role !== "user") {
      this.error = "Отмена бронирования доступна только пользователю";
      return;
    }

    this.resetMessage();
    this.mutatingBooking = true;

    try {
      await this.request<Booking>(`/bookings/${bookingId}`, {
        method: "DELETE",
      });
      runInAction(() => {
        this.cache.events = 0;
        this.cache.bookings = 0;
        this.info = "Бронирование отменено";
      });
      await Promise.all([this.loadEvents(true), this.loadBookings(true)]);
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Ошибка отмены бронирования";
      });
      throw error;
    } finally {
      runInAction(() => {
        this.mutatingBooking = false;
      });
    }
  }
}

export const appStore = new AppStore();
