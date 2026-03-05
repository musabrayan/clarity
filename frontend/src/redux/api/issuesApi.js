import { baseApi } from './baseApi';

const issuesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET all issues (agent view) with optional filters
    getIssues: builder.query({
      query: ({ status, priority } = {}) => {
        const params = new URLSearchParams();
        if (status && status !== 'all') params.append('status', status);
        if (priority && priority !== 'all') params.append('priority', priority);
        const qs = params.toString();
        return `/api/v1/issues/${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res) => res.issues ?? [],
      providesTags: ['Issues'],
    }),

    // GET issues for a specific user
    getUserIssues: builder.query({
      query: (userId) => `/api/v1/issues/user/${userId}`,
      transformResponse: (res) => res.issues ?? [],
      providesTags: ['Issues'],
    }),

    // POST create a new issue / bug report
    createIssue: builder.mutation({
      query: (body) => ({
        url: '/api/v1/issues/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Issues'],
    }),

    // PATCH update issue status
    updateIssueStatus: builder.mutation({
      query: ({ issueId, status }) => ({
        url: `/api/v1/issues/${issueId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Issues'],
    }),
  }),
});

export const {
  useGetIssuesQuery,
  useGetUserIssuesQuery,
  useCreateIssueMutation,
  useUpdateIssueStatusMutation,
} = issuesApi;
