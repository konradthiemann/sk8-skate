import { Link } from "@tanstack/react-router";
import { navItems } from "@/app.sections";
import { useTelemetry } from "@/lib/telemetry/useTelemetry";

export function BottomNav() {
  const telemetry = useTelemetry();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <ul className="mx-auto grid max-w-3xl auto-cols-fr grid-flow-col">
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              onClick={() => telemetry.trackNavigation(to, "bottom-nav")}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary"
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
