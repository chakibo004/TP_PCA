// src/redux/apiSlice.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface LoginPayload {
  username: string;
  password: string;
  remember: boolean;
}
export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}
export interface VerifyOtpPayload {
  sessionId: string;
  code: string;
  flow: 0 | 1;
}
export interface KeySessionPayload {
  targetId: string;
}
export interface MessagePayload {
  sessionId: string;
  ciphertext: string;
}

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:4000/auth",
    credentials: "include",
  }),
  endpoints: (builder) => ({
    // --- Auth classique ---
    loginUser: builder.mutation<{ sessionId: string }, LoginPayload>({
      query: (body) => ({
        url: "/login",
        method: "POST",
        body,
      }),
    }),
    registerUser: builder.mutation<{ sessionId: string }, RegisterPayload>({
      query: (body) => ({
        url: "/register",
        method: "POST",
        body,
      }),
    }),
    verifyOtp: builder.mutation<
      { message: string; username?: string; tokenExpiration?: number },
      VerifyOtpPayload
    >({
      query: ({ sessionId, code, flow }) => ({
        url: flow === 1 ? "/verifyRegisterOtp" : "/verifyOtp",
        method: "POST",
        body: { sessionId, code },
      }),
    }),

    // --- Distribution de clés (cas 1 & 2) ---
    case1Initiate: builder.mutation<{ sessionId: string }, KeySessionPayload>({
      query: (body) => ({
        url: "/key/case1/initiate",
        method: "POST",
        body,
      }),
    }),
    case1Fetch: builder.query<{ keyHex: string }, string>({
      query: (sessionId) => `/key/case1/fetch/${sessionId}`,
    }),
    case2Generate: builder.mutation<{ sessionId: string }, void>({
      query: () => ({
        url: "/key/case2/generate",
        method: "POST",
      }),
    }),
    case2Fetch: builder.query<{ keyHex: string }, string>({
      query: (sessionId) => `/key/case2/fetch/${sessionId}`,
    }),

    // --- Auth mutuelle par clés symétriques ---
    startKeyAuth: builder.mutation<
      { authSessionId: string; Na: string },
      { keySessionId: string; targetId: string }
    >({
      query: (body) => ({
        url: "/mutual/keyAuth/start",
        method: "POST",
        body,
      }),
    }),
    respondKeyAuth: builder.mutation<{ Nb: string }, { authSessionId: string }>(
      {
        query: (body) => ({
          url: "/mutual/keyAuth/respond",
          method: "POST",
          body,
        }),
      }
    ),
    confirmKeyAuth: builder.mutation<
      { Na: string; Nb: string; keyHex: string },
      { authSessionId: string }
    >({
      query: (body) => ({
        url: "/mutual/keyAuth/confirm",
        method: "POST",
        body,
      }),
    }),

    // --- Diffie‑Hellman (cas 3) ---
    getDHParams: builder.query<{ p: string; g: string }, void>({
      query: () => "/dh/params",
    }),
    dhInitiate: builder.mutation<
      { sessionId: string; A: string },
      { p: string; g: string }
    >({
      query: (body) => ({
        url: "/dh/initiate",
        method: "POST",
        body,
      }),
    }),
    dhRespond: builder.mutation<
      { B: string },
      { sessionId: string; p: string; g: string; B: string }
    >({
      query: (body) => ({
        url: "/dh/respond",
        method: "POST",
        body,
      }),
    }),

    // --- Messagerie chiffrée ---
    sendMessage: builder.mutation<{ message: string }, MessagePayload>({
      query: (body) => ({
        url: "/message/send",
        method: "POST",
        body,
      }),
    }),
    getMessages: builder.query<
      {
        id: number;
        sessionId: string;
        senderId: number;
        ciphertext: string;
        createdAt: string;
      }[],
      string
    >({
      query: (sessionId) => `/message/${sessionId}`,
    }),
  }),
});

export const {
  useLoginUserMutation,
  useRegisterUserMutation,
  useVerifyOtpMutation,
  useCase1InitiateMutation,
  useCase1FetchQuery,
  useCase2GenerateMutation,
  useCase2FetchQuery,
  useStartKeyAuthMutation,
  useRespondKeyAuthMutation,
  useConfirmKeyAuthMutation,
  useGetDHParamsQuery,
  useDhInitiateMutation,
  useDhRespondMutation,
  useSendMessageMutation,
  useGetMessagesQuery,
} = apiSlice;
