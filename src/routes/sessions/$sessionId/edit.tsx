import { createFileRoute } from "@tanstack/react-router";
import { SessionEditScreen } from "@/features/sessions/components/SessionEditScreen";

export const Route = createFileRoute("/sessions/$sessionId/edit")({
  component: SessionEditScreen,
});
