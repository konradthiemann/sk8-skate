/**
 * Central per-app configuration. This file (plus the accent block in
 * index.css) is what distinguishes the three SK8 apps from each other.
 */
export const appConfig = {
  /** Identifier sent with every telemetry batch. */
  id: "skate",
  name: "SK8 Skate",
  shortName: "Skate",
  description: "Trick-Tree, Sessions und Training auf dem Weg zum Contest.",
  themeColor: "#0f766e",
  backgroundColor: "#0f1413",
} as const;

export type AppId = typeof appConfig.id;
