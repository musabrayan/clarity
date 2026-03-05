import { baseApi } from './baseApi';

const recordingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET recordings for an agent
    getAgentRecordings: builder.query({
      query: (agentId) => `/api/v1/call/recordings/agent/${agentId}`,
      transformResponse: (res) => res.recordings ?? [],
      providesTags: ['Recordings'],
    }),

    // GET recordings for a customer
    getUserRecordings: builder.query({
      query: (userId) => `/api/v1/call/recordings/user/${userId}`,
      transformResponse: (res) => res.recordings ?? [],
      providesTags: ['Recordings'],
    }),

    // PATCH ticket status on a recording
    updateTicketStatus: builder.mutation({
      query: ({ recordingSid, ticketStatus }) => ({
        url: `/api/v1/call/recordings/${recordingSid}/status`,
        method: 'PATCH',
        body: { ticketStatus },
      }),
      // Optimistic update: patch the cache immediately
      async onQueryStarted({ recordingSid, ticketStatus }, { dispatch, queryFulfilled, getState }) {
        // We need the agentId to find the correct cache entry
        const state = getState();
        const agentId = state.user?.currentUser?._id;
        if (!agentId) return;

        const patchResult = dispatch(
          recordingsApi.util.updateQueryData('getAgentRecordings', agentId, (draft) => {
            const item = draft.find((r) => r.recordingSid === recordingSid);
            if (item) item.ticketStatus = ticketStatus;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: ['Recordings'],
    }),

    // GET customer call history by phone number
    getCustomerHistory: builder.query({
      query: (phoneNumber) => `/api/v1/call/customer-history/${phoneNumber}`,
      transformResponse: (res) => res.calls ?? [],
      providesTags: ['CustomerHistory'],
    }),
  }),
});

export const {
  useGetAgentRecordingsQuery,
  useGetUserRecordingsQuery,
  useUpdateTicketStatusMutation,
  useGetCustomerHistoryQuery,
} = recordingsApi;
