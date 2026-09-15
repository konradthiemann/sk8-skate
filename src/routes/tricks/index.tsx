import { createFileRoute } from "@tanstack/react-router";
import { TrickTreeScreen } from "@/features/tricks/components/TrickTreeScreen";
import { trickTreeSearchSchema } from "@/features/tricks/schema";

export const Route = createFileRoute("/tricks/")({
  validateSearch: trickTreeSearchSchema,
  component: TrickTreeScreen,
});
