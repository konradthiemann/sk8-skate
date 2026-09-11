import { type Control, useController } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { formatSuccessRate } from "../format";
import type { SessionFormRequest, SessionFormValues } from "../schema";
import { NumberStepper } from "./NumberStepper";

interface SessionTrickRowProps {
  control: Control<SessionFormValues, unknown, SessionFormRequest>;
  index: number;
  trickName: string;
  onRemove: () => void;
  attemptsError?: string;
  landedError?: string;
}

/** One selected trick: quote, the two counters, and a way to remove the row. */
export function SessionTrickRow({
  control,
  index,
  trickName,
  onRemove,
  attemptsError,
  landedError,
}: SessionTrickRowProps) {
  const attempts = useController({ control, name: `tricks.${index}.attempts` });
  const landed = useController({ control, name: `tricks.${index}.landed` });

  const attemptsValue = attempts.field.value;
  const landedValue = landed.field.value;
  const rate = attemptsValue > 0 ? landedValue / attemptsValue : 0;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{trickName}</span>
        <span className="text-sm text-muted-foreground">Quote {formatSuccessRate(rate)}</span>
      </div>

      <div className="space-y-1">
        <NumberStepper
          fieldLabel="Versuche"
          trickName={trickName}
          value={attemptsValue}
          min={1}
          max={999}
          onChange={attempts.field.onChange}
          increaseTrack="session.attempts-plus"
          decreaseTrack="session.attempts-minus"
          invalid={attemptsError !== undefined}
        />
        {attemptsError !== undefined && (
          <p role="alert" className="text-sm text-destructive">
            {attemptsError}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <NumberStepper
          fieldLabel="Treffer"
          trickName={trickName}
          value={landedValue}
          min={0}
          max={attemptsValue}
          onChange={landed.field.onChange}
          increaseTrack="session.landed-plus"
          decreaseTrack="session.landed-minus"
          invalid={landedError !== undefined}
        />
        {landedError !== undefined && (
          <p role="alert" className="text-sm text-destructive">
            {landedError}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="h-11 px-3"
        aria-label={`${trickName} entfernen`}
        data-track="session.trick-remove"
        onClick={onRemove}
      >
        Entfernen
      </Button>
    </div>
  );
}
