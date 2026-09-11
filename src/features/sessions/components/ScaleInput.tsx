import type * as React from "react";
import { cn } from "@/lib/utils";

interface ScaleInputProps {
  /** Used both as the accessible group name and to build stable option ids. */
  label: string;
  min: number;
  max: number;
  value: number | null;
  onChange: (value: number) => void;
}

/**
 * Discrete 1..10 / 0..10 scale (Anstrengung, Knieschmerz links) as a
 * `role="radiogroup"` of `role="radio"` buttons – exactly one value can be
 * selected, matching the WAI-ARIA radiogroup pattern with roving `tabindex`
 * and arrow-key navigation (`ux.md` Abschnitt 7, Ergänzung 2).
 */
export function ScaleInput({ label, min, max, value, onChange }: ScaleInputProps) {
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const slug = label.toLowerCase().replace(/\s+/g, "-");
  const selectedIndex = value === null ? 0 : Math.max(0, options.indexOf(value));

  function focusOption(index: number) {
    document.getElementById(`scale-${slug}-${options[index]}`)?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = Math.min(options.length - 1, index + 1);
      onChange(options[nextIndex]);
      focusOption(nextIndex);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = Math.max(0, index - 1);
      onChange(options[nextIndex]);
      focusOption(nextIndex);
    }
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option, index) => {
        const checked = value === option;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a native radio can't carry the tile's own text/border styling; this follows the WAI-ARIA "button as radio" pattern used for discrete scales (ux.md Abschnitt 7, Ergänzung 2).
          <button
            key={option}
            id={`scale-${slug}-${option}`}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              checked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-transparent hover:bg-accent",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
