// ✅ RTK Query (Redux Toolkit API slice) version of the auth logic

// 1. redux/apiSlice.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "http://localhost:4000/auth" }),
  endpoints: (builder) => ({
    loginUser: builder.mutation<
      { message: string },
      { username: string; password: string }
    >({
      query: (body) => ({
        url: "/login",
        method: "POST",
        body,
      }),
    }),
    registerUser: builder.mutation<
      { message: string },
      { username: string; email: string; password: string }
    >({
      query: (body) => ({
        url: "/register",
        method: "POST",
        body,
      }),
    }),
    verifyOtp: builder.mutation<
      { message: string },
      { email: string; code: string }
    >({
      query: (body) => ({
        url: "/verify-otp",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useLoginUserMutation,
  useRegisterUserMutation,
  useVerifyOtpMutation,
} = apiSlice;
