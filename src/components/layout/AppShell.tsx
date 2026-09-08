import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { appConfig } from "@/app.config";
import { BottomNav } from "./BottomNav";
import { ContestCountdown } from "./ContestCountdown";

interface AppShellProps {
  children: ReactNode;
}

/** Mobile-first frame: sticky header, scrolling content, fixed bottom navigation. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <Link to="/" className="font-semibold tracking-tight">
            {appConfig.name}
          </Link>
          <ContestCountdown />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
