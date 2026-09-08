import { createFileRoute } from "@tanstack/react-router";
import { StartScreen } from "@/features/start/StartScreen";

export const Route = createFileRoute("/")({
  component: StartScreen,
});
