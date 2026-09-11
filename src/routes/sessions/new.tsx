import { createFileRoute } from "@tanstack/react-router";
import { SessionCreateScreen } from "@/features/sessions/components/SessionCreateScreen";

export const Route = createFileRoute("/sessions/new")({
  component: SessionCreateScreen,
});
