import { createFileRoute } from "@tanstack/react-router";
import { TrickDetailScreen } from "@/features/tricks/components/TrickDetailScreen";

export const Route = createFileRoute("/tricks/$slug")({
  component: TrickDetailScreen,
});
