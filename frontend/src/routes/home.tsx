import { createFileRoute } from "@tanstack/react-router";
import Home from "../pages/Home";
import { withProtection } from '../utils/protected';

export const Route = createFileRoute("/home")({
  component: withProtection(Home),
});
