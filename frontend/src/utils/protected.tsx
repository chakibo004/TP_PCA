// src/utils/protected.tsx
import React, { ComponentType, useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "../redux/hooks";
import { useNavigate } from "@tanstack/react-router";
import { checkAuth, sessionExpired } from "../redux/authSlice";

export function withProtection<P extends object>(Wrapped: ComponentType<P>) {
  return (props: P) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { isLoggedIn, tokenExpiration } = useAppSelector((s) => s.auth);

    // Pour attendre le premier checkAuth()
    const [checked, setChecked] = useState(false);

    // 1) Au montage, on recharge depuis le localStorage
    useEffect(() => {
      dispatch(checkAuth());
      setChecked(true);
    }, [dispatch]);

    // 2) Si, après ce check, on n'est pas loggé → /login
    useEffect(() => {
      if (checked && !isLoggedIn) {
        navigate({ to: "/login" });
      }
    }, [checked, isLoggedIn, navigate]);

    // 3) On programme une déconnexion automatique à l'expiration
    useEffect(() => {
      if (isLoggedIn && tokenExpiration) {
        const msLeft = tokenExpiration - Date.now();
        if (msLeft <= 0) {
          dispatch(sessionExpired());
          navigate({ to: "/login" });
        } else {
          const timer = window.setTimeout(() => {
            dispatch(sessionExpired());
            navigate({ to: "/login" });
          }, msLeft);
          return () => clearTimeout(timer);
        }
      }
    }, [isLoggedIn, tokenExpiration, dispatch, navigate]);

    // Tant qu'on n'a pas fait le premier check, ou qu'on n'est pas loggé, on ne rend rien
    if (!checked || !isLoggedIn) return null;

    // Tout est OK, on affiche le composant protégé
    return <Wrapped {...props} />;
  };
}
