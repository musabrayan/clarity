import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
 

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}`,
    credentials: 'include',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Availability'],
  endpoints: (builder) => ({
    // Register a new user
    register: builder.mutation({
      query: (credentials) => ({
        url: 'api/auth/register/',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Store tokens
          if (data.access) {
            localStorage.setItem('authToken', data.access);
          }
          if (data.refresh) {
            localStorage.setItem('refreshToken', data.refresh);
          }
        } catch (err) {
          console.error('Registration error:', err);
        }
      },
    }),

    // Login user
    login: builder.mutation({
      query: (credentials) => ({
        url: 'api/auth/login/',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Store tokens
          if (data.access) {
            localStorage.setItem('authToken', data.access);
          }
          if (data.refresh) {
            localStorage.setItem('refreshToken', data.refresh);
          }
        } catch (err) {
          console.error('Login error:', err);
        }
      },
    }),

    // Logout user
    logout: builder.mutation({
      query: () => {
        const refreshToken = localStorage.getItem('refreshToken');
        return {
          url: 'api/auth/logout/',
          method: 'POST',
          body: { refresh: refreshToken },
        };
      },
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (err) {
          console.error('Logout error:', err);
        } finally {
          // Always clear local storage
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          dispatch(authApi.util.resetApiState());
        }
      },
    }),
    
    // Get agent availability status
    getAvailability: builder.query({
      query: () => 'api/auth/availability/',
      providesTags: ['Availability'],
    }),
    
    // Set agent availability (agents only)
    setAvailability: builder.mutation({
      query: (isAvailable) => ({
        url: 'api/auth/availability/',
        method: 'POST',
        body: { is_available: isAvailable },
      }),
      invalidatesTags: ['Availability'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useGetAvailabilityQuery,
  useSetAvailabilityMutation,
} = authApi;
