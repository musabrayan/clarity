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
      query: (customerId) => {
        const params = customerId ? `?customer_id=${customerId}` : '';
        return `/api/v1/call/available-agent${params}`;
      },
    }),

    getUserInfo: builder.query({
      query: (userId) => `/api/v1/user/${userId}/info`,
    }),

    // DRL Routing Management
    trainRouting: builder.mutation({
      query: (params) => ({
        url: '/api/v1/call/routing/train',
        method: 'POST',
        body: params,
      }),
    }),

    getRoutingStats: builder.query({
      query: () => '/api/v1/call/routing/stats',
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
  useTrainRoutingMutation,
  useLazyGetRoutingStatsQuery,
} = callApi;

export default callApi;

