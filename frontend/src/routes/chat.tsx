import { createFileRoute } from "@tanstack/react-router";
import PeerChat from "../pages/PeerChat";
import { withProtection } from "../utils/protected";

export const Route = createFileRoute("/chat")({
  component: withProtection(PeerChat),
});
