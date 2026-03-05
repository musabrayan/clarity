import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import userReducer from './slice/user.slice';
import { baseApi } from './api/baseApi';

// Persist configuration
const persistConfig = {
    key: 'user',
    storage
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, userReducer);

// Configure store
const store = configureStore({
    reducer: {
        user: persistedReducer,
        [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
            },
        }).concat(baseApi.middleware),
});

export const persistor = persistStore(store);
export default store;