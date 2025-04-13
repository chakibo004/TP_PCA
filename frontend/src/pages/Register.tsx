// 3. Register.tsx avec OTP
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setUser } from "../redux/authSlice";
import {
  useRegisterUserMutation,
  useVerifyOtpMutation,
} from "../redux/apiSlice";
import { useNavigate } from "@tanstack/react-router";

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"register" | "verify">("register");
  const [message, setMessage] = useState("");

  const [registerUser] = useRegisterUserMutation();
  const [verifyOtp] = useVerifyOtpMutation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await registerUser(form).unwrap();
      if (res.message.includes("Code")) {
        setStep("verify");
        setMessage("Un code vous a été envoyé par email.");
      } else {
        setMessage(res.message);
      }
    } catch (err: any) {
      setMessage(err?.data?.message || "Erreur lors de l'inscription");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await verifyOtp({ email: form.email, code: otp }).unwrap();
      if (res.message.includes("succ")) {
        dispatch(setUser({ username: form.username }));
        navigate({ to: "/home" });
      } else {
        setMessage(res.message);
      }
    } catch (err: any) {
      setMessage(err?.data?.message || "Erreur lors de la vérification");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form
        onSubmit={step === "register" ? handleRegister : handleVerify}
        className="bg-white p-6 rounded shadow-md w-80 space-y-4"
      >
        <h2 className="text-xl font-semibold text-center">
          {step === "register" ? "Inscription" : "Vérification du code"}
        </h2>

        {step === "register" ? (
          <>
            <input
              type="text"
              placeholder="Nom d'utilisateur"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />
          </>
        ) : (
          <input
            type="text"
            placeholder="Code OTP reçu par email"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        )}

        {message && (
          <p className="text-red-500 text-sm text-center">{message}</p>
        )}

        <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
          {step === "register" ? "S'inscrire" : "Valider le code"}
        </button>

        {step === "register" && (
          <p
            className="text-sm text-center text-blue-600 cursor-pointer hover:underline"
            onClick={() => navigate({ to: "/login" })}
          >
            Déjà inscrit ? Se connecter
          </p>
        )}
      </form>
    </div>
  );
};

export default Register;
