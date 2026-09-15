import { Badge } from "@/components/ui/badge";
import { TRICK_STATUS_META, toTrickStatus } from "../status";

interface TrickStatusBadgeProps {
  /** Roher API-Wert (schema.d.ts:917 ist ein loses `string`, kein Union-Typ). */
  status: string;
}

/**
 * Farbe **und** Symbol **und** Text (Ticket, Abschnitt "Statusdarstellung").
 * Normalisiert den rohen API-Status selbst (design.md §5.6) – Aufrufer
 * reichen den Wert unverändert durch.
 */
export function TrickStatusBadge({ status }: TrickStatusBadgeProps) {
  const meta = TRICK_STATUS_META[toTrickStatus(status)];
  const Icon = meta.icon;

  return (
    <Badge variant={meta.badgeVariant} className={meta.badgeClassName}>
      <Icon aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}
