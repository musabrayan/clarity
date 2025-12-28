import { configureStore } from '@reduxjs/toolkit';
import { authApi } from './authApi';
import { chatApi } from './chatApi';
import authReducer from './authSlice';
import chatUiReducer from './chatUiSlice';

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [chatApi.reducerPath]: chatApi.reducer,
    auth: authReducer,
    chatUi: chatUiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authApi.middleware, chatApi.middleware),
});

export default store;
