import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { NotFoundScreen } from "@/components/layout/NotFoundScreen";
import { useScreenTracking } from "@/lib/telemetry/useScreenTracking";

function RootLayout() {
  useScreenTracking();

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundScreen,
});
