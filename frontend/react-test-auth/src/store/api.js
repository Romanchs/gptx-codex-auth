import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/' }),
  endpoints: (builder) => ({
    hello: builder.query({
      query: () => 'hello',
    }),
  }),
});

export const { useHelloQuery } = api;
