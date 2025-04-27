// src/redux/authSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import AlertService from "../utils/AlertService";

interface AuthState {
  user: { id: number; username: string } | null;
  isLoggedIn: boolean;
  tokenExpiration: number | null;
  lastSync: number;
  alertShown: boolean;
}

interface CredentialsPayload {
  id: number;
  username: string;
  tokenExpiration: number;
}

interface StoredAuthData extends CredentialsPayload {
  timestamp: number;
}

const initialState: AuthState = {
  user: null,
  isLoggedIn: false,
  tokenExpiration: null,
  lastSync: Date.now(),
  alertShown: false,
};

const clearAuthState = (state: AuthState) => {
  state.user = null;
  state.isLoggedIn = false;
  state.tokenExpiration = null;
  state.alertShown = false;
  localStorage.removeItem("authData");
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Appelé après verifyOtp().unwrap()
    setCredentials: (state, action: PayloadAction<CredentialsPayload>) => {
      const { id, username, tokenExpiration } = action.payload;
      const timestamp = Date.now();

      state.user = { id, username };
      state.isLoggedIn = true;
      state.tokenExpiration = tokenExpiration;
      state.lastSync = timestamp;
      state.alertShown = false;

      const toStore: StoredAuthData = {
        id,
        username,
        tokenExpiration,
        timestamp,
      };
      localStorage.setItem("authData", JSON.stringify(toStore));
    },

    // Déconnexion volontaire
    logout: (state) => {
      clearAuthState(state);
      state.lastSync = Date.now();
    },

    // À déclencher si la session expire côté frontend
    sessionExpired: (state) => {
      clearAuthState(state);
    },

    // À appeler au chargement de l’app (ou périodiquement)
    checkAuth: (state) => {
      const now = Date.now();

      // Si déjà loggé et non expiré → on garde
      if (
        state.isLoggedIn &&
        state.tokenExpiration &&
        now < state.tokenExpiration
      ) {
        return;
      }

      // Sinon, on recharge depuis localStorage
      const raw = localStorage.getItem("authData");
      if (raw) {
        try {
          const data: StoredAuthData = JSON.parse(raw);
          if (now < data.tokenExpiration) {
            state.user = { id: data.id, username: data.username };
            state.isLoggedIn = true;
            state.tokenExpiration = data.tokenExpiration;
            state.lastSync = data.timestamp;
            state.alertShown = false;
            return;
          }
        } catch {
          // JSON invalide → on purge
        }
      }

      // Session expirée ou non trouvée
      if (!state.alertShown) {
        state.alertShown = true;
        AlertService.infoWithCallback(
          "Session expirée",
          "Votre session a expiré. Veuillez vous reconnecter.",
          () => {
            window.location.href = "/login";
          }
        );
      }
      clearAuthState(state);
    },
  },
});

export const { setCredentials, logout, sessionExpired, checkAuth } =
  authSlice.actions;
export default authSlice.reducer;
