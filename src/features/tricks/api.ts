import { api } from "@/lib/api/client";
import { ApiRequestError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type TrickResponse = components["schemas"]["TrickResponse"];
export type TrickTreeResponse = components["schemas"]["TrickTreeResponse"];
export type TrickTreeNode = components["schemas"]["TrickTreeNode"];
export type TrickTreeEdge = components["schemas"]["TrickTreeEdge"];
export type TrickDetailResponse = components["schemas"]["TrickDetailResponse"];
export type TrickDetailProgress = components["schemas"]["TrickDetailProgress"];
export type TrickRefView = components["schemas"]["TrickRefView"];
export type TrickHistoryEntry = components["schemas"]["TrickHistoryEntry"];
export type TrickPolicyView = components["schemas"]["TrickPolicyView"];
export type TrickRecommendationResponse = components["schemas"]["TrickRecommendationResponse"];
export type TrickSuggestion = components["schemas"]["TrickSuggestion"];
export type TrickDosage = components["schemas"]["TrickDosage"];
export type PauseHintView = components["schemas"]["PauseHintView"];

export { ApiRequestError };

export const trickKeys = {
  list: () => ["tricks", "list"] as const,
  tree: () => ["tricks", "tree"] as const,
  detail: (slug: string) => ["tricks", "detail", slug] as const,
  recommendation: () => ["tricks", "recommendation"] as const,
};

/** The full trick catalog, oldest/master data – changes only via migration (T-0101). */
export async function fetchTricks(): Promise<TrickResponse[]> {
  const { data, error } = await api.GET("/api/tricks");
  if (error) {
    throw new Error("Der Trick-Katalog konnte nicht geladen werden.");
  }
  return data.items;
}

/** Alle Tricks mit Status und Voraussetzungen als Kanten (T-0201/T-0202). */
export async function fetchTrickTree(): Promise<TrickTreeResponse> {
  const { data, error } = await api.GET("/api/trick-tree");
  if (error) {
    throw new Error("Der Trick-Tree konnte nicht geladen werden.");
  }
  return data;
}

/**
 * Einzelner Trick mit Zahlenblock, Voraussetzungen/Freischaltungen und
 * Verlauf (T-0204). Wirft `ApiRequestError`, damit der Aufrufer 404 (Ticket
 * gibt es nicht) von jedem anderen Fehler (allgemeiner Fehlertext)
 * unterscheiden kann – dasselbe Muster wie `sessions/api.ts`.
 */
export async function fetchTrickDetail(slug: string): Promise<TrickDetailResponse> {
  const { data, error, response } = await api.GET("/api/tricks/{slug}", {
    params: { path: { slug } },
  });
  if (error) {
    throw new ApiRequestError(response.status, error);
  }
  return data;
}

/** Aktuelle Fokus-Empfehlung für die Fokus-Karte auf `/tricks` (T-0204). */
export async function fetchTrickRecommendation(): Promise<TrickRecommendationResponse> {
  const { data, error, response } = await api.GET("/api/trick-recommendation");
  if (error) {
    throw new ApiRequestError(response.status, error);
  }
  return data;
}

/**
 * Fokus-Markierung, an `TrickTreeGraph`/`TrickTreeList` durchgereicht
 * (design.md §5.3): ein `Set` statt einer Map je Knoten, weil `focusLimit`
 * (R-02) auf 2 begrenzt ist – zwei O(1)-Prüfungen pro Knoten reichen.
 */
export interface TrickFocusMarker {
  /** Slugs aller Fokus-Tricks (primary + secondary), Reihenfolge irrelevant. */
  focusSlugs: Set<string>;
  /** Slug des `primary`-Tricks, oder `null` wenn keiner. Nur dieser bekommt den Textbadge. */
  primarySlug: string | null;
}
