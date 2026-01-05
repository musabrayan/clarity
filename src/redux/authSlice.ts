import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "@/types/auth";

interface AuthState {
    loading: boolean;
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    role: string | null;
}

const initialState: AuthState = {
    loading: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    role: null,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setUser: (state, action: PayloadAction<User | null>) => {
            state.user = action.payload;
        },
        // Set all auth data at once (login/register)
        setAuth: (state, action: PayloadAction<{ user: User; accessToken: string; refreshToken: string }>) => {
            state.user = action.payload.user;
            state.accessToken = action.payload.accessToken;
            state.refreshToken = action.payload.refreshToken;
            state.role = action.payload.user.role;
            // Sync to localStorage for persistence
            localStorage.setItem("user", JSON.stringify(action.payload.user));
            localStorage.setItem("accessToken", action.payload.accessToken);
            localStorage.setItem("refreshToken", action.payload.refreshToken);
            localStorage.setItem("role", action.payload.user.role);
        },
        // Update just the access token (after refresh)
        setAccessToken: (state, action: PayloadAction<string>) => {
            state.accessToken = action.payload;
            localStorage.setItem("accessToken", action.payload);
        },
        // Clear all auth data (logout)
        clearAuth: (state) => {
            state.user = null;
            state.accessToken = null;
            state.refreshToken = null;
            state.role = null;
            localStorage.removeItem("user");
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("role");
        },
    },
});

export const { setLoading, setUser, setAuth, setAccessToken, clearAuth } = authSlice.actions;
export default authSlice.reducer;
