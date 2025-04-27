import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppSelector } from "../redux/hooks";
import {
  useGetUsersQuery,
  useFindPeerSessionMutation,
} from "../redux/apiSlice";
import AlertService from "../utils/AlertService";

const Discussions: React.FC = () => {
  const navigate = useNavigate();
  const me = useAppSelector((s) => s.auth.user!.id);
  const { data: users, isLoading } = useGetUsersQuery();
  const [findSession] = useFindPeerSessionMutation();

  if (isLoading) return <p>Chargement…</p>;

  const startChat = async (otherId: number) => {
    if (otherId === me)
      return AlertService.validation(
        "Invalide",
        "Tu ne peux pas discuter avec toi-même."
      );

    try {
      // 1) on tente de retrouver une session existante (peer-to-peer)
      const { sessionId } = await findSession({
        otherId: String(otherId),
      }).unwrap();
      // Navigate to Chat with existing session ID and peer flow
      return navigate({
        to: "/chat", // Changed route back to /chat
        search: { session: sessionId, flow: "peer" }, // Added flow parameter
      });
    } catch {
      // 2) si aucune n’existe, on part en création (peer-to-peer)
      // Navigate to Chat with target ID to initiate handshake and peer flow
      return navigate({
        to: "/chat", // Changed route back to /chat
        search: { target: String(otherId), flow: "peer" }, // Added flow parameter
      });
    }
    // Note: Add logic here later if you want a button to specifically start a server-flow chat
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Vos contacts</h1>
      <ul className="space-y-2">
        {users!.map((u) => (
          <li key={u.id} className="flex justify-between p-2 border rounded">
            <span>{u.username}</span>
            {/* This button currently only starts peer-to-peer chats */}
            <button
              onClick={() => startChat(u.id)}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Chat (Peer)
            </button>
            {/* You might add another button later for server chat */}
            {/* <button onClick={() => startServerChat(u.id)} className="...">Chat (Server)</button> */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Discussions;
