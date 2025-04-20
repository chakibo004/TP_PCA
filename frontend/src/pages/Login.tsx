import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppDispatch } from "../redux/hooks";
import { setCredentials } from "../redux/authSlice";
import { useLoginUserMutation, useVerifyOtpMutation } from "../redux/apiSlice";
import AlertService from "../utils/AlertService";
import OtpInput from "../components/OtpInput";

const MAX_OTP_ATTEMPTS = 3;

const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [step, setStep] = useState<"login" | "verify">("login");
  const [form, setForm] = useState({
    username: "",
    password: "",
    remember: false,
  });
  const [sessionId, setSessionId] = useState("");
  const [otp, setOtp] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);

  const [loginUser, { isLoading: isLoggingIn }] = useLoginUserMutation();
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyOtpMutation();

  // Affiche message de succès venant de l'inscription
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const success = p.get("success");
    if (success) AlertService.success(success);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { sessionId: sid } = await loginUser(form).unwrap();
      setSessionId(sid);
      setStep("verify");
      setOtp("");
      setOtpAttempts(0);
      AlertService.success("OTP envoyé", "Vérifie ta boîte mail.");
    } catch (err: any) {
      AlertService.error(
        "Erreur de connexion",
        err?.data?.message || "Impossible de se connecter."
      );
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { username, tokenExpiration } = await verifyOtp({
        sessionId,
        code: otp,
        flow: 0,
      }).unwrap();

      // Stocke la session (username + expiration)
      dispatch(
        setCredentials({
          username: username!,
          tokenExpiration: tokenExpiration!,
        })
      );
      AlertService.success("Connecté", "Bienvenue !");
      navigate({ to: "/home" });
    } catch (err: any) {
      const status = err?.status;
      if (status === 403) {
        AlertService.error("Compte bloqué", "Trop de tentatives.");
        window.location.href = "/login";
        return;
      }
      setOtpAttempts((prev) => prev + 1);
      const remaining = MAX_OTP_ATTEMPTS - (otpAttempts + 1);
      const msg = err?.data?.message || "Code invalide";
      AlertService.error(
        "Erreur OTP",
        remaining > 0
          ? `${msg} Il te reste ${remaining} essai(s).`
          : `${msg} Ton compte est bloqué.`
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-800 to-indigo-600 p-4">
      <div className="max-w-md w-full bg-white bg-opacity-90 backdrop-filter backdrop-blur-lg rounded-2xl shadow-2xl p-8 space-y-6">
        <h2 className="text-3xl font-extrabold text-center text-indigo-700">
          {step === "login" ? "Connexion" : "Vérification OTP"}
        </h2>

        <form
          onSubmit={step === "login" ? handleLogin : handleVerify}
          className="space-y-4"
        >
          {step === "login" ? (
            <>
              {/* Username */}
              <div>
                <label className="block text-gray-700 mb-1">
                  Nom d’utilisateur
                </label>
                <input
                  type="text"
                  placeholder="login"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-indigo-500"
                  required
                />
              </div>
              {/* Password */}
              <div>
                <label className="block text-gray-700 mb-1">Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-indigo-500"
                  required
                />
              </div>
              {/* Remember me */}
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  checked={form.remember}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, remember: e.target.checked }))
                  }
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="remember"
                  className="ml-2 text-sm text-gray-700"
                >
                  Se souvenir de moi
                </label>
              </div>
            </>
          ) : (
            <>
              {/* OTP Input */}
              <OtpInput value={otp} onChange={setOtp} disabled={isVerifying} />
              <p className="text-sm text-gray-600 text-center">
                Essai {otpAttempts} / {MAX_OTP_ATTEMPTS}
              </p>
            </>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || isVerifying}
            className={`w-full py-3 rounded-lg text-white font-semibold transition-colors ${
              isLoggingIn || isVerifying
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {step === "login"
              ? isLoggingIn
                ? "Connexion…"
                : "Se connecter"
              : isVerifying
                ? "Vérification…"
                : "Valider le code"}
          </button>
        </form>

        {step === "login" && (
          <p
            className="text-center text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer"
            onClick={() => navigate({ to: "/register" })}
          >
            Pas encore inscrit ? S’inscrire
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
