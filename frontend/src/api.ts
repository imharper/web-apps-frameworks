import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
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
import type { RootState } from "./store";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders: (headers, { getState }) => {
      headers.set("Content-Type", "application/json");

      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return headers;
    },
  }),
  keepUnusedDataFor: 60,
  tagTypes: ["User", "Events", "Bookings"],
  endpoints: (builder) => ({
    register: builder.mutation<AuthResponse, RegisterDto>({
      query: (body) => ({
        url: "/auth/register",
        method: "POST",
        body,
      }),
    }),
    login: builder.mutation<AuthResponse, LoginDto>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
    }),
    getCurrentUser: builder.query<User, void>({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),
    getEvents: builder.query<EventItem[], void>({
      query: () => "/events",
      providesTags: ["Events"],
    }),
    createEvent: builder.mutation<EventItem, CreateEventDto>({
      query: (body) => ({
        url: "/events",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Events"],
    }),
    getBookings: builder.query<Booking[], void>({
      query: () => "/bookings",
      providesTags: ["Bookings"],
    }),
    createBooking: builder.mutation<Booking, CreateBookingDto>({
      query: (body) => ({
        url: "/bookings",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Bookings", "Events"],
    }),
    cancelBooking: builder.mutation<Booking, string>({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Bookings", "Events"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useGetCurrentUserQuery,
  useGetEventsQuery,
  useCreateEventMutation,
  useGetBookingsQuery,
  useCreateBookingMutation,
  useCancelBookingMutation,
} = api;
