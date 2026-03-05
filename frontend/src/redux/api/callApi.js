import { baseApi } from './baseApi';

const callApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAgentToken: builder.query({
      query: () => '/api/v1/call/token/agent',
    }),

    getCustomerToken: builder.query({
      query: () => '/api/v1/call/token/customer',
    }),

    registerAgent: builder.mutation({
      query: () => ({
        url: '/api/v1/call/register-agent',
        method: 'POST',
      }),
    }),

    unregisterAgent: builder.mutation({
      query: () => ({
        url: '/api/v1/call/unregister-agent',
        method: 'POST',
      }),
    }),

    getAvailableAgent: builder.query({
      query: () => '/api/v1/call/available-agent',
    }),

    getUserInfo: builder.query({
      query: (userId) => `/api/v1/user/${userId}/info`,
    }),
  }),
});

export const {
  useLazyGetAgentTokenQuery,
  useLazyGetCustomerTokenQuery,
  useRegisterAgentMutation,
  useUnregisterAgentMutation,
  useLazyGetAvailableAgentQuery,
  useLazyGetUserInfoQuery,
} = callApi;

export default callApi;
