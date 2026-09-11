import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type TrickResponse = components["schemas"]["TrickResponse"];

export const trickKeys = {
  list: () => ["tricks", "list"] as const,
};

/** The full trick catalog, oldest/master data – changes only via migration (T-0101). */
export async function fetchTricks(): Promise<TrickResponse[]> {
  const { data, error } = await api.GET("/api/tricks");
  if (error) {
    throw new Error("Der Trick-Katalog konnte nicht geladen werden.");
  }
  return data.items;
}
