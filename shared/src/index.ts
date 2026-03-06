export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  venue: string;
  capacity: number;
  availableSeats: number;
  createdBy: string;
}

export interface CreateEventDto {
  title: string;
  description: string;
  startsAt: string;
  venue: string;
  capacity: number;
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  quantity: number;
  createdAt: string;
}

export interface CreateBookingDto {
  eventId: string;
  quantity: number;
}

export interface ApiError {
  error: string;
}
