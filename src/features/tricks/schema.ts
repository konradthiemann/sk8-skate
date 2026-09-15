import { z } from "zod";

/**
 * Suchparameter von `/tricks` (design.md §5.1). `.catch(default)` statt
 * `.parse()`, damit ein ungültiger Wert in der Adresse nie die Route
 * scheitern lässt.
 */
export const trickTreeSearchSchema = z.object({
  view: z.enum(["graph", "list"]).catch("graph"),
  showLocked: z.boolean().catch(true),
});

export type TrickTreeSearch = z.infer<typeof trickTreeSearchSchema>;
