import { createFileRoute } from "@tanstack/react-router";
import { SessionDetailScreen } from "@/features/sessions/components/SessionDetailScreen";

export const Route = createFileRoute("/sessions/$sessionId/")({
  component: SessionDetailScreen,
});
