import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTelemetry } from "./useTelemetry";

/** Emits screen_view / time_on_screen for the initial screen and every resolved navigation. */
export function useScreenTracking(): void {
  const router = useRouter();
  const telemetry = useTelemetry();

  useEffect(() => {
    telemetry.trackScreen(router.state.location.pathname);
    return router.subscribe("onResolved", ({ toLocation }) => {
      telemetry.trackScreen(toLocation.pathname);
    });
  }, [router, telemetry]);
}
