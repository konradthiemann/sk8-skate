import { createFileRoute } from "@tanstack/react-router";
import { getSection } from "@/app.sections";
import { PlaceholderScreen } from "@/components/layout/PlaceholderScreen";

export const Route = createFileRoute("/tricks")({
  component: () => <PlaceholderScreen section={getSection("/tricks")} />,
});
