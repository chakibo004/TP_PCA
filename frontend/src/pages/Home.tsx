// src/pages/Home.tsx
import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { logout } from "../redux/authSlice";
import AlertService from "../utils/AlertService";

const Home: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    AlertService.infoWithCallback(
      "Déconnexion",
      "Vous avez été déconnecté.",
      () => navigate({ to: "/login" })
    );
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-green-50 space-y-6">
      <h1 className="text-3xl font-bold text-green-700">
        Bienvenue, {user?.username} ! 🎉
      </h1>
      <div className="space-x-4">
        <button
          onClick={() => navigate({ to: "/discussions" })}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Mes discussions
        </button>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
};

export default Home;
