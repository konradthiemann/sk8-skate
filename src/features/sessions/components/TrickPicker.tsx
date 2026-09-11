import type { TrickResponse } from "@/features/tricks/api";
import { cn } from "@/lib/utils";

interface TrickPickerProps {
  tricks: TrickResponse[];
  selectedSlugs: string[];
  onToggle: (trick: TrickResponse) => void;
}

interface TrickGroupProps {
  title: string;
  tricks: TrickResponse[];
  selectedSlugs: string[];
  onToggle: (trick: TrickResponse) => void;
}

function TrickGroup({ title, tricks, selectedSlugs, onToggle }: TrickGroupProps) {
  return (
    <fieldset aria-label={title} className="space-y-2 border-0 p-0 m-0">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {tricks.map((trick) => {
          const pressed = selectedSlugs.includes(trick.slug);
          return (
            <button
              key={trick.slug}
              type="button"
              aria-pressed={pressed}
              data-track={pressed ? "session.trick-remove" : "session.trick-add"}
              onClick={() => onToggle(trick)}
              className={cn(
                "h-11 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                pressed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-transparent hover:bg-accent",
              )}
            >
              {trick.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Two tap-groups instead of a select/dropdown: 16 tricks fit a phone screen
 * and a single tap beats any control that has to open first (design.md
 * Abschnitt 7). "Deine Ziele" sorted by `goalOrder`, "Weitere Tricks" by
 * `difficulty` (Kriterium 10).
 */
export function TrickPicker({ tricks, selectedSlugs, onToggle }: TrickPickerProps) {
  const goals = [...tricks]
    .filter((trick) => trick.isGoal)
    .sort((a, b) => (a.goalOrder ?? 0) - (b.goalOrder ?? 0));
  const others = [...tricks]
    .filter((trick) => !trick.isGoal)
    .sort((a, b) => a.difficulty - b.difficulty);

  return (
    <div className="space-y-4">
      <TrickGroup
        title="Deine Ziele"
        tricks={goals}
        selectedSlugs={selectedSlugs}
        onToggle={onToggle}
      />
      <TrickGroup
        title="Weitere Tricks"
        tricks={others}
        selectedSlugs={selectedSlugs}
        onToggle={onToggle}
      />
    </div>
  );
}
