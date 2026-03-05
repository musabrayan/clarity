import { createSlice } from '@reduxjs/toolkit';

// User slice
const userSlice = createSlice({
    name: 'user',
    initialState: {
        currentUser: null,
        isAuthenticated: false,
    },
    reducers: {
        setUser: (state, action) => {
            state.currentUser = action.payload;
            state.isAuthenticated = true;
        },
        clearUser: (state) => {
            state.currentUser = null;
            state.isAuthenticated = false;
        },
    },
});

export const { setUser, clearUser } = userSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────
export const selectUser = (state) => state.user;
export const selectCurrentUser = (state) => state.user.currentUser;
export const selectIsAuthenticated = (state) => state.user.isAuthenticated;
export const selectUserRole = (state) => state.user.currentUser?.role ?? null;
export const selectUserId = (state) => state.user.currentUser?._id ?? null;

export default userSlice.reducer;