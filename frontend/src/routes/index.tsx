// 4. routes/index.tsx (redirige vers /login si non connecté)
import { createFileRoute, redirect } from "@tanstack/react-router";
import { store } from "../redux/store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const { isLoggedIn } = store.getState().auth;
    if (isLoggedIn) {
      throw redirect({ to: "/home" });
    } else {
      throw redirect({ to: "/login" });
    }
  },
  component: () => null,
});
