import { createFileRoute } from "@tanstack/react-router";
import Discussions from "../pages/Discussions";
import { withProtection } from "../utils/protected";

export const Route = createFileRoute("/discussions")({
  component: withProtection(Discussions),
});
