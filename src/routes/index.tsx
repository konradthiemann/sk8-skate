import { createFileRoute } from "@tanstack/react-router";
import { StartSessionSummary } from "@/features/sessions/components/StartSessionSummary";
import { StartScreen } from "@/features/start/StartScreen";

export const Route = createFileRoute("/")({
  component: () => (
    <StartScreen>
      <StartSessionSummary />
    </StartScreen>
  ),
});
