import type * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NumberStepperProps {
  /** e.g. "Versuche" or "Treffer" – combined with the trick name for the accessible name. */
  fieldLabel: string;
  trickName: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  increaseTrack: string;
  decreaseTrack: string;
  invalid?: boolean;
}

/**
 * `−`/value/`+` counter with a directly editable number input, all touch
 * targets at least 44 px. The `+`/`−` buttons clamp to `[min, max]`
 * (Kriterium 15); direct typing does not – out-of-range values surface as a
 * validation error on submit instead (Kriterium 16), so this component never
 * silently discards what was typed.
 */
export function NumberStepper({
  fieldLabel,
  trickName,
  value,
  min,
  max,
  onChange,
  increaseTrack,
  decreaseTrack,
  invalid = false,
}: NumberStepperProps) {
  const accessibleName = `${fieldLabel} für ${trickName}`;

  // A typed-but-not-yet-committed value (e.g. the field is momentarily empty
  // while the user retypes it) is tracked separately from `value` so the
  // input never snaps back to `min` mid-keystroke – see Kriterium 16, where
  // clearing and retyping a smaller number must not get clamped away.
  const [draft, setDraft] = useState<string | null>(null);

  function clamp(next: number): number {
    return Math.min(max, Math.max(min, next));
  }

  function commit(next: number) {
    setDraft(null);
    onChange(next);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    setDraft(raw);
    if (raw.trim().length === 0) {
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  }

  function handleBlur() {
    if (draft !== null && draft.trim().length === 0) {
      commit(min);
    } else {
      setDraft(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-sm text-muted-foreground">{fieldLabel}</span>
      <Button
        type="button"
        variant="outline"
        className={cn("h-11 w-11 shrink-0 p-0 text-lg")}
        aria-label={`${accessibleName}: Eins weniger`}
        data-track={decreaseTrack}
        onClick={() => commit(clamp(value - 1))}
      >
        −
      </Button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={accessibleName}
        aria-invalid={invalid ? "true" : undefined}
        value={draft ?? value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="h-11 w-16 rounded-md border border-input bg-transparent px-2 text-center text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
      />
      <Button
        type="button"
        variant="outline"
        className={cn("h-11 w-11 shrink-0 p-0 text-lg")}
        aria-label={`${accessibleName}: Eins mehr`}
        data-track={increaseTrack}
        onClick={() => commit(clamp(value + 1))}
      >
        +
      </Button>
    </div>
  );
}
