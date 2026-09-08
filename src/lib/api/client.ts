import createClient, { type Client } from "openapi-fetch";
import { env } from "@/lib/env";
import type { paths } from "./schema";

export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  /** Backend origin, e.g. http://localhost:8000 (trailing slash tolerated). */
  baseUrl: string;
  /** Static key sent as X-Api-Key; omitted from requests when empty. */
  apiKey: string;
}

export function createApiClient({ baseUrl, apiKey }: ApiClientOptions): ApiClient {
  return createClient<paths>({
    baseUrl: baseUrl.replace(/\/+$/, ""),
    headers: apiKey ? { "X-Api-Key": apiKey } : undefined,
    // Resolve fetch per request instead of binding it at creation time.
    fetch: (request) => globalThis.fetch(request),
  });
}

/** The one HTTP entry point of the app; configured from VITE_API_URL / VITE_API_KEY. */
export const api: ApiClient = createApiClient({ baseUrl: env.apiUrl, apiKey: env.apiKey });
