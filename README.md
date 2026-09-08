# SK8 Skate

Progressive Web App für den Skate-Teil des SK8-Projekts: Trick-Tree, Sessions und Training auf dem Weg zum Contest am 18. September 2027 in Braunschweig.

Die App ist eine von drei baugleichen PWAs (`sk8-skate`, `sk8-nutrition`, `sk8-habits`). `sk8-skate` ist die Referenz; gemeinsame Dateien (Design-Tokens, Telemetrie, API-Client, Tooling) werden in die beiden anderen Apps gespiegelt. Verbindliche Entscheidungen stehen in den ADRs des Repos `sk8-docs` (ADR-003, 005, 006, 007, 008, 009).

Stand: 7. September 2026

## Stack

| Bereich | Wahl |
|---|---|
| Build | Vite 8, TypeScript (strict) |
| UI | React 19 |
| Routing | TanStack Router (dateibasiert, `src/routes/`, generierte `routeTree.gen.ts`) |
| Server-State | TanStack Query |
| Client-State | Zustand (sparsam, nur UI-Zustand) |
| Styling | Tailwind CSS v4, Design-Tokens als CSS-Variablen in `src/index.css` |
| Komponenten | shadcn/ui (Stil `new-york`, Radix-Primitives) in `src/components/ui/` |
| Formulare | react-hook-form + zod |
| API-Client | openapi-fetch, Typen aus der OpenAPI-Spec des Backends (`pnpm gen:api`) |
| Charts / Graph | Recharts, @xyflow/react (Trick-Tree) |
| Datum | date-fns mit `de`-Locale |
| PWA | vite-plugin-pwa (Manifest, Service Worker mit `autoUpdate`) |
| Tests | Vitest, Testing Library, MSW |
| Lint / Format | Biome |
| Paketmanager | pnpm |

## Voraussetzungen

- Node 22 (LTS)
- pnpm 10 (`corepack enable` oder `npm i -g pnpm`)
- Optional: laufendes `sk8-backend` unter `http://localhost:8000`

## Einrichtung

```sh
./scripts/setup.sh        # pnpm install + Git-Hooks aktivieren
cp .env.example .env.local
pnpm dev                  # http://localhost:5173
```

`scripts/setup.sh` setzt `git config core.hooksPath .githooks`. Der Pre-Commit-Hook führt Lint, Typprüfung und Tests aus; ein Commit mit roten Checks ist nicht möglich.

## Skripte

| Befehl | Zweck |
|---|---|
| `pnpm dev` | Entwicklungsserver auf Port 5173 |
| `pnpm build` | Typprüfung aller Projekte + Produktions-Build nach `dist/` |
| `pnpm preview` | Gebautes Bundle lokal ausliefern |
| `pnpm test` | Tests einmal ausführen |
| `pnpm test:watch` | Tests im Watch-Modus |
| `pnpm lint` | Biome: Lint, Format-Check, Import-Sortierung |
| `pnpm lint:fix` | Biome mit automatischen Korrekturen |
| `pnpm format` | Nur formatieren |
| `pnpm typecheck` | `tsc --noEmit` für den App-Code |
| `pnpm gen:api` | `src/lib/api/schema.d.ts` aus `http://localhost:8000/api/doc.json` neu erzeugen (Backend muss laufen; `SPEC_URL=… pnpm gen:api` für andere Umgebungen) |
| `pnpm icons` | PWA-Icons aus `public/logo.svg` neu generieren |

## Umgebungsvariablen

Alle Variablen werden zur **Build-Zeit** eingebacken (Vite). Lokal in `.env.local`, auf Railway als Service-Variablen.

| Variable | Beispiel | Bedeutung |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Basis-URL des Backends, ohne abschließenden Slash |
| `VITE_API_KEY` | `dev-key-change-me` | Statischer Key, wird als Header `X-Api-Key` gesendet (ADR-006) |
| `VITE_TELEMETRY` | `on` / `off` | UX-Telemetrie ein- oder ausschalten (ADR-009) |

Der API-Key landet im Bundle. Das ist für die Single-User-App ein bewusst akzeptiertes Restrisiko (siehe ADR-006); Rotation erfolgt über Railway-Variable und Redeploy.

## Struktur

```
src/
  main.tsx                  Einstieg: QueryClientProvider, TelemetryProvider, RouterProvider
  app.config.ts             App-Kennung, Name, Farben (einer der zwei app-spezifischen Punkte)
  app.sections.ts           Bereiche der App (Karten auf dem Startbildschirm, Bottom-Navigation)
  index.css                 Tailwind-Import + Design-Tokens (Akzent-Block app-spezifisch, Rest geteilt)
  routeTree.gen.ts          Generiert vom Router-Plugin – nicht von Hand ändern
  routes/                   Dateirouten: __root.tsx (App-Shell), index.tsx (Start), …
  features/<bereich>/       Fachlogik: Komponenten, Hooks, api.ts, schema.ts, Tests daneben
  components/ui/            shadcn/ui-Komponenten
  components/layout/        AppShell, BottomNav, ContestCountdown, Platzhalter, 404
  hooks/                    Allgemeine Hooks (useNow)
  lib/api/                  client.ts (openapi-fetch, X-Api-Key), schema.d.ts (generiert)
  lib/telemetry/            Provider, Hook, Queue (Batching), Client (DOM-Listener), Transport, types.ts (aus schema.d.ts abgeleitet)
  lib/contest.ts            Contest-Datum und Countdown-Helfer
  test/                     Vitest-Setup, MSW-Handler, renderApp-Helfer
```

### Telemetrie (ADR-009)

- Ein `TelemetryProvider` pro App, Zugriff über `useTelemetry()`.
- `screen_view` und `time_on_screen` entstehen automatisch bei jedem Routenwechsel.
- `interaction` entsteht durch Klick/Submit auf Elementen mit `data-track="<bereich>.<aktion>"`.
- `navigation` wird von der Bottom-Navigation ausgelöst.
- Events werden gepuffert (20 Stück oder 10 s) und als Batch an `POST /api/telemetry/events` gesendet. Beim Verlassen der Seite wird mit `fetch(..., { keepalive: true })` geleert, weil `navigator.sendBeacon` den Header `X-Api-Key` nicht setzen kann.
- `target` und `meta` sind im Vertrag optional (`default: null`). Die App lässt sie weg, wenn sie nicht zutreffen; `toRequestBody()` im Transport schreibt den dokumentierten `null`-Standard, damit der Request exakt dem generierten Typ entspricht.
- Fehler werden verschluckt; Telemetrie stört die App nie.

### API-Vertrag

| Endpunkt | Auth | Antworten |
|---|---|---|
| `GET /api/health` | – | `200 {"status":"ok","time":"<ISO8601>"}` |
| `POST /api/telemetry/events` | `X-Api-Key` | `202 {"accepted":n}`, `401`/`404`/`405` `{"error":"<code>"}`, `422 {"error":"validation_failed","violations":[{"field","message"}]}` |

`src/lib/api/schema.d.ts` wird mit `pnpm gen:api` aus dem OpenAPI-Dokument des Backends erzeugt und **nicht von Hand bearbeitet**. `scripts/gen-api.sh` startet den Generator in einer eigenen, unter `~/.cache/sk8-openapi-typescript` zwischengespeicherten npm-Umgebung, weil er TypeScript 5 als Peer erwartet, diese App aber mit TypeScript 7 gebaut wird.

Die fachlichen Typen in `src/lib/telemetry/types.ts` sind durchgehend aus den generierten Schemas abgeleitet (`TelemetryBatchRequest["app"]`, `TelemetryEventInput["type"]`) – keine Union wird zweimal geschrieben. Auch die MSW-Handler sind über `Record<TelemetryApp, true>` an den Vertrag gekoppelt: Ändert das Backend eine Aufzählung, schlägt `pnpm typecheck` fehl, statt stillschweigend auseinanderzulaufen.

## Tests

Tests liegen neben der jeweiligen Datei (`Foo.test.tsx`). Sie prüfen Verhalten aus Nutzersicht (Rollen, deutsche Texte) und mocken die API mit MSW exakt nach Vertrag.

| Datei | Beweist |
|---|---|
| `lib/contest.test.ts` | Tageszählung bis zum Contest, deutsche Formatierung |
| `lib/telemetry/queue.test.ts` | Batching nach 20 Events oder 10 s, Payload-Form, Fehlertoleranz |
| `lib/telemetry/client.test.ts` | Screen-Tracking, `data-track`-Interaktionen, Navigation, `pagehide`/`visibilitychange`, Aus-Schalter |
| `lib/telemetry/TelemetryProvider.test.tsx` | Provider/Hook-Verdrahtung, Start/Stop, Fallback ohne Provider |
| `lib/telemetry/transport.test.ts` | `null`-Standard für weggelassene `target`/`meta`, exakte Request-Form, `X-Api-Key`, `keepalive` |
| `lib/api/client.test.ts` | Header `X-Api-Key`, typisierte 200/202/401/422-Antworten |
| `routes/__root.test.tsx` | App-Shell: Header, Countdown, Bottom-Navigation, Telemetrie bei Routenwechsel, 404 |
| `features/start/StartScreen.test.tsx` | Startbildschirm: Countdown, Bereichskarten, `data-track` |

## Deployment

Das Repo enthält ein Multi-Stage-`Dockerfile` (Node 22 + pnpm → `dist/`, dann `caddy:2-alpine`) und eine `railway.json` (Builder `DOCKERFILE`, Healthcheck `/`, Restart `ON_FAILURE`).

- Caddy liefert `dist/` mit SPA-Fallback (`try_files {path} /index.html`) aus, cached `/assets/*` ein Jahr (gehashte Dateinamen) und setzt für `index.html`, `sw.js` und Manifest `Cache-Control: no-cache`.
- Der Port kommt aus `$PORT` (Railway), Standard 80.
- `VITE_*`-Variablen müssen als Railway-Service-Variablen gesetzt sein; sie werden beim Docker-Build als `ARG` übernommen.

Lokaler Test des Images:

```sh
docker build --build-arg VITE_API_URL=http://localhost:8000 --build-arg VITE_API_KEY=dev-key-change-me -t sk8-skate .
docker run --rm -p 8080:80 sk8-skate
```

## Konventionen (ADR-008)

- UI-Texte Deutsch (Du-Form), Code, Bezeichner und Kommentare Englisch.
- Commit-Messages Englisch, Conventional Commits, imperativ, kleingeschrieben.
- Branches: `main` (Production), `develop` (Development), `feat/<slug>` per Pull-Request nach `develop`.
