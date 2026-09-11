import { createFileRoute } from "@tanstack/react-router";
import { SessionListScreen } from "@/features/sessions/components/SessionListScreen";

export const Route = createFileRoute("/sessions/")({
  component: SessionListScreen,
});
