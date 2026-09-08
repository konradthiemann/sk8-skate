import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function NotFoundScreen() {
  return (
    <section className="space-y-4 py-8 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Seite nicht gefunden</h1>
      <p className="text-sm text-muted-foreground">Diese Adresse gibt es in der App nicht.</p>
      <Button asChild variant="outline">
        <Link to="/">Zur Startseite</Link>
      </Button>
    </section>
  );
}
