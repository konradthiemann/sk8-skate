import type { AppSection } from "@/app.sections";
import { Badge } from "@/components/ui/badge";

interface PlaceholderScreenProps {
  section: AppSection;
}

/** Stand-in for a feature area that is not implemented yet. */
export function PlaceholderScreen({ section }: PlaceholderScreenProps) {
  const Icon = section.icon;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">{section.title}</h1>
        <Badge variant="outline">Bald verfügbar</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{section.description}</p>
      <p className="text-sm text-muted-foreground">Dieser Bereich ist noch in Arbeit.</p>
    </section>
  );
}
