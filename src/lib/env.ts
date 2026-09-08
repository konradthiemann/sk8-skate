function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Build-time configuration (see .env.example). */
export const env = {
  apiUrl: trimTrailingSlash(import.meta.env.VITE_API_URL ?? ""),
  apiKey: import.meta.env.VITE_API_KEY ?? "",
  telemetryEnabled: import.meta.env.VITE_TELEMETRY !== "off",
} as const;
