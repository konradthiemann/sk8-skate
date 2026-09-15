import { CircleCheck, CircleDot, Lock, type LucideIcon, Target } from "lucide-react";
import type { badgeVariants } from "@/components/ui/badge";

export type TrickStatus = "sitzt" | "uebe" | "bereit" | "gesperrt";

type BadgeVariant = NonNullable<Parameters<typeof badgeVariants>[0]>["variant"];

interface TrickStatusMeta {
  label: string;
  icon: LucideIcon;
  badgeVariant: BadgeVariant;
  badgeClassName?: string;
}

const KNOWN_STATUSES: readonly TrickStatus[] = ["sitzt", "uebe", "bereit", "gesperrt"];

/**
 * Narrows the API's loose `string` (schema.d.ts:917) to the known union;
 * falls back to the most restrictive state instead of crashing on an
 * unexpected future value (design.md §5.6).
 */
export function toTrickStatus(raw: string): TrickStatus {
  if ((KNOWN_STATUSES as readonly string[]).includes(raw)) {
    return raw as TrickStatus;
  }
  return "gesperrt";
}

/** Farbe + Symbol + Text je Status (Ticket, Abschnitt "Statusdarstellung"). */
export const TRICK_STATUS_META: Record<TrickStatus, TrickStatusMeta> = {
  sitzt: { label: "Sitzt", icon: CircleCheck, badgeVariant: "default" },
  uebe: {
    label: "Übe ich",
    icon: Target,
    badgeVariant: "secondary",
    badgeClassName: "bg-accent text-accent-foreground",
  },
  bereit: { label: "Bereit", icon: CircleDot, badgeVariant: "outline" },
  gesperrt: {
    label: "Gesperrt",
    icon: Lock,
    badgeVariant: "secondary",
    badgeClassName: "text-muted-foreground",
  },
};
