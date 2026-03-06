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

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (init.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || "Ошибка запроса");
  }

  return data as T;
}

export const api = {
  register: (payload: RegisterDto) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginDto) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: (token: string) => request<User>("/auth/me", { method: "GET" }, token),

  getEvents: () => request<EventItem[]>("/events", { method: "GET" }),

  createEvent: (payload: CreateEventDto, token: string) =>
    request<EventItem>("/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),

  getBookings: (token: string) => request<Booking[]>("/bookings", { method: "GET" }, token),

  createBooking: (payload: CreateBookingDto, token: string) =>
    request<Booking>("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),
};
