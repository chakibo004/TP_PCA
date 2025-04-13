
// 2. Login.tsx avec OTP
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { setUser } from "../redux/authSlice";
import {
  useLoginUserMutation,
  useVerifyOtpMutation,
} from "../redux/apiSlice";
import { useNavigate } from "@tanstack/react-router";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"login" | "verify">("login");
  const [message, setMessage] = useState("");

  const [loginUser] = useLoginUserMutation();
  const [verifyOtp] = useVerifyOtpMutation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await loginUser(form).unwrap();
      if (res.message.includes("Code")) {
        setEmail(`${form.username}@gmail.com`); // à adapter avec un vrai email plus tard
        setStep("verify");
        setMessage("Un code vous a été envoyé par email.");
      } else {
        setMessage(res.message);
      }
    } catch (err: any) {
      setMessage(err?.data?.message || "Erreur serveur");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await verifyOtp({ email, code: otp }).unwrap();
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
        onSubmit={step === "login" ? handleLogin : handleVerify}
        className="bg-white p-6 rounded shadow-md w-80 space-y-4"
      >
        <h2 className="text-xl font-semibold text-center">
          {step === "login" ? "Connexion" : "Vérification du code"}
        </h2>

        {step === "login" ? (
          <>
            <input
              type="text"
              placeholder="Nom d'utilisateur"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
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

        {message && <p className="text-red-500 text-sm text-center">{message}</p>}

        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          {step === "login" ? "Se connecter" : "Valider le code"}
        </button>

        {step === "login" && (
          <p
            className="text-sm text-center text-blue-600 cursor-pointer hover:underline"
            onClick={() => navigate({ to: "/register" })}
          >
            Pas encore inscrit ? S'inscrire
          </p>
        )}
      </form>
    </div>
  );
};

export default Login;
