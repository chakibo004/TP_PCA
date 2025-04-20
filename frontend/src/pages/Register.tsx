import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useRegisterUserMutation,
  useVerifyOtpMutation,
} from "../redux/apiSlice";
import AlertService from "../utils/AlertService";
import OtpInput from "../components/OtpInput";

const MAX_OTP_ATTEMPTS = 3;

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<"register" | "verify">("register");
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [sessionId, setSessionId] = useState("");
  const [otp, setOtp] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);

  const [registerUser, { isLoading: isRegistering }] =
    useRegisterUserMutation();
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyOtpMutation();

  const resetForm = () => {
    setStep("register");
    setForm({ username: "", email: "", password: "" });
    setSessionId("");
    setOtp("");
    setOtpAttempts(0);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { sessionId: sid } = await registerUser(form).unwrap();
      setSessionId(sid);
      setStep("verify");
      setOtpAttempts(0);
      AlertService.success("OTP envoyé", "Vérifie ta boîte mail.");
    } catch (err: any) {
      AlertService.error(
        "Erreur inscription",
        err?.data?.message || "Impossible de s'inscrire."
      );
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyOtp({ sessionId, code: otp, flow: 1 }).unwrap();
      const msg = encodeURIComponent("Inscription réussie !");
      navigate({ to: `/login?success=${msg}` });
    } catch (err: any) {
      const status = err?.status;
      if (status === 403) {
        AlertService.error(
          "Trop de tentatives",
          "Inscription annulée. Recommence plus tard."
        );
        resetForm();
        window.location.href = "/register";
        return;
      }
      setOtpAttempts((prev) => prev + 1);
      const remaining = MAX_OTP_ATTEMPTS - (otpAttempts + 1);
      const errMsg = err?.data?.message || "Code invalide";
      AlertService.error(
        "Erreur OTP",
        remaining > 0
          ? `${errMsg} Il te reste ${remaining} essai(s).`
          : `${errMsg} Inscription annulée.`
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-800 to-teal-600 p-4">
      <div className="max-w-md w-full bg-white bg-opacity-90 backdrop-filter backdrop-blur-lg rounded-2xl shadow-2xl p-8 space-y-6">
        <h2 className="text-3xl font-extrabold text-center text-teal-700">
          {step === "register" ? "Créer un compte" : "Vérification OTP"}
        </h2>

        <form
          onSubmit={step === "register" ? handleRegister : handleVerify}
          className="space-y-4"
        >
          {step === "register" ? (
            <>
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
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="votre@mail.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-teal-500"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <OtpInput value={otp} onChange={setOtp} disabled={isVerifying} />
              <p className="text-sm text-gray-600 text-center">
                Essai {otpAttempts} / {MAX_OTP_ATTEMPTS}
              </p>
            </>
          )}

          <button
            type="submit"
            disabled={isRegistering || isVerifying}
            className={`w-full py-3 rounded-lg text-white font-semibold transition-colors ${
              isRegistering || isVerifying
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            {step === "register"
              ? isRegistering
                ? "Inscription…"
                : "S'inscrire"
              : isVerifying
                ? "Vérification…"
                : "Valider le code"}
          </button>
        </form>

        {step === "register" && (
          <p
            className="text-center text-sm text-teal-600 hover:text-teal-800 cursor-pointer"
            onClick={() => navigate({ to: "/login" })}
          >
            Déjà inscrit ? Se connecter
          </p>
        )}
      </div>
    </div>
  );
};

export default Register;
