import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const TOKEN_STORAGE_KEY = "ticket_cabinet_token";

interface AuthState {
  token: string | null;
}

const initialState: AuthState = {
  token: typeof window === "undefined" ? null : localStorage.getItem(TOKEN_STORAGE_KEY),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
      localStorage.setItem(TOKEN_STORAGE_KEY, action.payload);
    },
    clearAuth(state) {
      state.token = null;
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    },
  },
});

export const { setToken, clearAuth } = authSlice.actions;
export default authSlice.reducer;
