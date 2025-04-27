import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import PeerChat from "../pages/PeerChat";
import ServerChat from "../pages/ServerChat";
import { withProtection } from "../utils/protected";

// Composant qui détermine quel chat afficher en fonction du paramètre "flow"
const ChatSelector = () => {
  const [searchParams] = useState(new URLSearchParams(window.location.search));
  const flow = searchParams.get("flow") || "peer";

  // Rendu conditionnel selon le flow
  return flow === "server" ? <ServerChat /> : <PeerChat />;
};

export const Route = createFileRoute("/chat")({
  component: withProtection(ChatSelector),
});
