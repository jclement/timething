/**
 * Index route — the only page in the app. Renders the Dashboard.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "../components/Dashboard";

export const Route = createFileRoute("/")({
  component: Dashboard,
});
