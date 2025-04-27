import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppSelector } from "../redux/hooks";
import {
  useGetUsersQuery,
  useFindPeerSessionMutation,
  useFindServerSessionMutation, // Restore this hook
} from "../redux/apiSlice";
import AlertService from "../utils/AlertService";

const Discussions: React.FC = () => {
  const navigate = useNavigate();
  const me = useAppSelector((s) => s.auth.user!.id);
  const { data: users, isLoading } = useGetUsersQuery();
  const [findPeerSession] = useFindPeerSessionMutation();
  const [findServerSession] = useFindServerSessionMutation(); // Restore this hook

  if (isLoading) return <p>Chargement…</p>;

  // --- Peer-to-Peer Chat Initiation (Unchanged) ---
  const startPeerChat = async (otherId: number) => {
    if (otherId === me) {
      return AlertService.validation(
        "Invalide",
        "Tu ne peux pas discuter avec toi-même."
      );
    }

    try {
      // Try to find existing peer-to-peer session
      const { sessionId } = await findPeerSession({
        otherId: String(otherId),
      }).unwrap();

      // Navigate to existing peer chat
      return navigate({
        to: "/chat",
        search: { session: sessionId, flow: "peer" },
      });
    } catch {
      // No existing session, navigate to create a new peer chat
      return navigate({
        to: "/chat",
        search: { target: String(otherId), flow: "peer" },
      });
    }
  };

  // --- Server-Assisted Chat Initiation (Restored Logic) ---
  const startServerChat = async (otherId: number) => {
    if (otherId === me) {
      return AlertService.validation(
        "Invalide",
        "Tu ne peux pas discuter avec toi-même."
      );
    }

    try {
      // Try to find an existing server-assisted session
      console.log(
        `[User ${me}] Attempting to find existing server session with ${otherId}...`
      );
      const { sessionId } = await findServerSession({
        otherId: String(otherId), // Convert number to string for API call
      }).unwrap();

      console.log(
        `[User ${me}] Found existing server session: ${sessionId}. Navigating...`
      );
      // Navigate to the existing server chat session
      return navigate({
        to: "/chat",
        search: { session: sessionId, flow: "server" },
      });
    } catch (error) {
      // Log the error if needed, e.g., if it's not just a 404 Not Found
      // console.error("Error finding server session:", error);

      // If no session is found (typically a 404 error), navigate to create a new one
      console.log(
        `[User ${me}] No existing server session found with ${otherId}. Navigating to create new session...`
      );
      return navigate({
        to: "/chat",
        search: { target: String(otherId), flow: "server" },
      });
    }
  };

  // --- Render (Unchanged) ---
  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Vos contacts</h1>
      <ul className="space-y-3">
        {users!.map((u) => (
          <li
            key={u.id}
            className="flex flex-col p-3 border rounded-lg bg-white dark:bg-gray-800 shadow-sm"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {u.username}
              </span>
              <div className="space-x-2">
                {/* Peer Chat Button */}
                <button
                  onClick={() => startPeerChat(u.id)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Chat (Peer)
                </button>
                {/* Server Chat Button */}
                <button
                  onClick={() => startServerChat(u.id)}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  Chat (Server)
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Discussions;
