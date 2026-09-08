import { TelemetryQueue } from "./queue";
import { createSessionId } from "./session";
import type { TelemetryApp, TelemetryEventDraft, TelemetrySend } from "./types";

export interface TelemetryClientOptions {
  app: TelemetryApp;
  send: TelemetrySend;
  /** Defaults to a fresh UUID. */
  sessionId?: string;
  /** When false every call is a no-op (VITE_TELEMETRY=off). */
  enabled?: boolean;
  maxEvents?: number;
  flushIntervalMs?: number;
  now?: () => Date;
}

export interface TelemetryClient {
  readonly app: TelemetryApp;
  readonly sessionId: string;
  readonly enabled: boolean;
  readonly currentScreen: string | null;
  /** Low-level: queue an arbitrary event. */
  track(event: TelemetryEventDraft): void;
  /** Screen change: closes the previous screen (time_on_screen) and opens the new one (screen_view). */
  trackScreen(screen: string): void;
  trackInteraction(target: string, meta?: Record<string, unknown>): void;
  trackNavigation(to: string, via: string): void;
  flush(): Promise<void>;
  /** Attaches document/window listeners (data-track clicks, submits, page hide). Returns the cleanup. */
  start(): () => void;
}

const TRACK_ATTRIBUTE = "data-track";
const UNKNOWN_SCREEN = "unknown";

function findTrackedElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(`[${TRACK_ATTRIBUTE}]`) : null;
}

export function createTelemetryClient(options: TelemetryClientOptions): TelemetryClient {
  const enabled = options.enabled ?? true;
  const sessionId = options.sessionId ?? createSessionId();
  const now = options.now ?? (() => new Date());
  const queue = new TelemetryQueue({
    app: options.app,
    sessionId,
    send: options.send,
    maxEvents: options.maxEvents,
    flushIntervalMs: options.flushIntervalMs,
    now,
  });

  let currentScreen: string | null = null;
  let enteredAt = 0;

  const track = (event: TelemetryEventDraft): void => {
    if (!enabled) {
      return;
    }
    try {
      queue.push(event);
    } catch {
      // Telemetry must never disturb the app.
    }
  };

  const closeCurrentScreen = (): void => {
    if (currentScreen === null) {
      return;
    }
    track({
      type: "time_on_screen",
      screen: currentScreen,
      meta: { ms: Math.max(0, now().getTime() - enteredAt) },
    });
  };

  const trackScreen = (screen: string): void => {
    if (!enabled || screen === currentScreen) {
      return;
    }
    closeCurrentScreen();
    const from = currentScreen;
    currentScreen = screen;
    enteredAt = now().getTime();
    track({ type: "screen_view", screen, meta: { from } });
  };

  const trackInteraction = (target: string, meta?: Record<string, unknown>): void => {
    if (target.length === 0) {
      return;
    }
    track({ type: "interaction", screen: currentScreen ?? UNKNOWN_SCREEN, target, meta });
  };

  const trackNavigation = (to: string, via: string): void => {
    track({
      type: "navigation",
      screen: currentScreen ?? UNKNOWN_SCREEN,
      target: to,
      meta: { from: currentScreen, to, via },
    });
  };

  const trackDomInteraction = (event: Event, via: "click" | "submit"): void => {
    const element = findTrackedElement(event.target);
    if (element === null) {
      return;
    }
    trackInteraction(element.getAttribute(TRACK_ATTRIBUTE) ?? "", {
      via,
      tag: element.tagName.toLowerCase(),
    });
  };

  const onClick = (event: Event): void => trackDomInteraction(event, "click");
  const onSubmit = (event: Event): void => trackDomInteraction(event, "submit");
  const onPageHide = (): void => {
    closeCurrentScreen();
    void queue.flush({ keepalive: true });
  };
  const onPageShow = (event: PageTransitionEvent): void => {
    // Restored from the back/forward cache: the screen is entered again.
    if (event.persisted) {
      enteredAt = now().getTime();
    }
  };
  const onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      void queue.flush({ keepalive: true });
    }
  };

  const start = (): (() => void) => {
    if (!enabled || typeof document === "undefined") {
      return () => {};
    }
    // Capture phase so components calling stopPropagation() cannot hide interactions.
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      void queue.flush({ keepalive: true });
    };
  };

  return {
    app: options.app,
    sessionId,
    enabled,
    get currentScreen() {
      return currentScreen;
    },
    track,
    trackScreen,
    trackInteraction,
    trackNavigation,
    flush: () => queue.flush(),
    start,
  };
}
