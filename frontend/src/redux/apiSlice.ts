// src/redux/apiSlice.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface LoginPayload {
  username: string;
  password: string;
  remember: boolean;
}
export interface User {
  id: number;
  username: string;
}
export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}
export interface VerifyOtpPayload {
  sessionId: string;
  code: string;
  flow: 0 | 1; // 0 = login, 1 = register
}
export interface DhPeerInitPayload {
  p: string;
  g: string;
  Apub: string;
  targetId: string;
}
export interface DhPeerRespondPayload {
  sessionId: string;
  Bpub: string;
}
export interface MessagePayload {
  sessionId: string;
  ciphertext: string;
}
interface DhRespParams {
  p: string;
  g: string;
  Apub: string;
  Bpub?: string;
}

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:4000",
    credentials: "include",
  }),
  endpoints: (b) => ({
    // --- Auth classique ---
    loginUser: b.mutation<{ sessionId: string }, LoginPayload>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    registerUser: b.mutation<{ sessionId: string }, RegisterPayload>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),
    verifyOtp: b.mutation<
      {
        message: string;
        userId: number;
        username: string;
        tokenExpiration: number;
      },
      VerifyOtpPayload
    >({
      query: ({ sessionId, code, flow }) => ({
        url: flow === 1 ? "/auth/verifyRegisterOtp" : "/auth/verifyOtp",
        method: "POST",
        body: { sessionId, code },
      }),
    }),

    // --- Liste des utilisateurs (contacts) ---
    getUsers: b.query<User[], void>({
      query: () => "/users",
    }),

    // --- Diffie–Hellman peer‑to‑peer (A ↔ B) ---
    getDhPeerParams: b.query<{ p: string; g: string }, void>({
      query: () => "/dh/peer/params",
    }),
    getDhPeerParamsForResponse: b.query<
      { p: string; g: string; Apub: string; Bpub?: string },
      string
    >({
      query: (sid) => `/dh/peer/params/response/${sid}`,
    }),
    getPeerSession: b.query<{ initiator: number; target: number }, string>({
      query: (sid) => `/dh/peer/session/${sid}`,
    }),
    initiatePeer: b.mutation<{ sessionId: string }, DhPeerInitPayload>({
      query: (body) => ({
        url: "/dh/peer/initiate",
        method: "POST",
        body,
      }),
    }),
    respondPeer: b.mutation<
      { Apub: string; Bpub: string },
      { sessionId: string; Bpub: string }
    >({
      query: (body) => ({
        url: "/dh/peer/respond",
        method: "POST",
        body,
      }),
    }),
    // **nouvelle** mutation pour retrouver une session existante
    findPeerSession: b.mutation<{ sessionId: string }, { otherId: string }>({
      query: (body) => ({
        url: "/dh/peer/find",
        method: "POST",
        body,
      }),
    }),

    // --- Diffie–Hellman server‑assisted (Admin ↔ A/B) ---
    dhServerGenerate: b.mutation<{ sessionId: string }, { targetId: string }>({
      query: (body) => ({
        url: "/dh/server/generate",
        method: "POST",
        body,
      }),
    }),
    dhServerFetch: b.query<{ keyHex: string }, string>({
      query: (sessionId) => `/dh/server/fetch/${sessionId}`,
    }),
    checkServerSession: b.query<void, string>({
      query: (sessionId) => `/dh/server/check/${sessionId}`,
    }),

    // --- Messagerie peer‑to‑peer ---
    sendPeerMessage: b.mutation<{ message: string }, MessagePayload>({
      query: (body) => ({
        url: "/message/peer/send",
        method: "POST",
        body,
      }),
    }),
    getPeerMessages: b.query<
      {
        id: number;
        sessionId: string;
        senderId: number;
        ciphertext: string;
        createdAt: string;
      }[],
      string
    >({
      query: (sessionId) => `/message/peer/${sessionId}`,
    }),

    // --- Messagerie server‑assisted ---
    sendServerMessage: b.mutation<{ message: string }, MessagePayload>({
      query: (body) => ({
        url: "/message/server/send",
        method: "POST",
        body,
      }),
    }),
    getServerMessages: b.query<
      {
        id: number;
        sessionId: string;
        senderId: number;
        ciphertext: string;
        createdAt: string;
      }[],
      string
    >({
      query: (sessionId) => `/message/server/${sessionId}`,
    }),
    requestMutualAuthChallenge: b.mutation<
      { message: string },
      { sessionId: string }
    >({
      query: (body) => ({
        url: "/mutualauth/request-challenge",
        method: "POST",
        body,
      }),
    }),
    verifyMutualAuthChallenge: b.mutation<
      { message: string },
      { sessionId: string; code: string }
    >({
      query: (body) => ({
        url: "/mutualauth/verify-challenge",
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

  useGetUsersQuery,

  useGetDhPeerParamsQuery,
  useGetDhPeerParamsForResponseQuery,
  useGetPeerSessionQuery,
  useInitiatePeerMutation,
  useRespondPeerMutation,
  useFindPeerSessionMutation,

  useDhServerGenerateMutation,
  useDhServerFetchQuery,
  useLazyCheckServerSessionQuery,
  useCheckServerSessionQuery,

  useSendPeerMessageMutation,
  useGetPeerMessagesQuery,
  useSendServerMessageMutation,
  useGetServerMessagesQuery,

  useRequestMutualAuthChallengeMutation,
  useVerifyMutualAuthChallengeMutation,
} = apiSlice;
