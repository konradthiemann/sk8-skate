import { HttpResponse, http } from "msw";
import { API_URL, TEST_API_KEY } from "@/test/msw/handlers";

/**
 * Test-only mirror of `TrickResponse` (T-0101). Not the wire contract itself –
 * that lives in `schema.d.ts` after `pnpm gen:api` – just enough shape for
 * fixtures and MSW handlers in this ticket's tests.
 */
export interface TrickFixture {
  id: string;
  slug: string;
  name: string;
  category: string;
  difficulty: number;
  description: string | null;
  isGoal: boolean;
  goalOrder: number | null;
  prerequisiteSlugs: string[];
}

function trick(
  overrides: Partial<TrickFixture> & Pick<TrickFixture, "slug" | "name">,
): TrickFixture {
  return {
    id: overrides.slug,
    category: "flatground",
    difficulty: 1,
    description: null,
    isGoal: false,
    goalOrder: null,
    prerequisiteSlugs: [],
    ...overrides,
  };
}

/** A small catalog for component-level tests that don't care about ordering. */
export function buildSmallTrickCatalog(): TrickFixture[] {
  return [
    trick({ slug: "ollie", name: "Ollie", isGoal: true, goalOrder: 1, difficulty: 1 }),
    trick({ slug: "kickflip", name: "Kickflip", isGoal: true, goalOrder: 2, difficulty: 3 }),
  ];
}

/**
 * Seven goal tricks (`isGoal`, `goalOrder` 1..7) followed by nine non-goal
 * tricks with distinct, ascending `difficulty` – matches acceptance
 * criterion 10 (7 tiles under "Deine Ziele" in `goalOrder`, 9 under "Weitere
 * Tricks" in `difficulty`).
 */
export function buildFullTrickCatalog(): TrickFixture[] {
  const goalNames = [
    "Ollie",
    "Kickflip",
    "Shuvit",
    "Pop Shove-it",
    "Boardslide",
    "50-50",
    "Heelflip",
  ];
  const otherNames = [
    "Nollie",
    "Varial Flip",
    "Hardflip",
    "Impossible",
    "360 Flip",
    "Bigspin",
    "Nosegrind",
    "Feeble Grind",
    "Smith Grind",
  ];

  const goals = goalNames.map((name, index) =>
    trick({
      slug: `goal-${index + 1}`,
      name,
      isGoal: true,
      goalOrder: index + 1,
      difficulty: goalNames.length - index,
    }),
  );
  const others = otherNames.map((name, index) =>
    trick({ slug: `other-${index + 1}`, name, isGoal: false, difficulty: index + 1 }),
  );

  return [...goals, ...others];
}

export function tricksHandler(items: TrickFixture[] = buildSmallTrickCatalog()) {
  return http.get(`${API_URL}/api/tricks`, ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ items }, { status: 200 });
  });
}

export function tricksErrorHandler(status = 500) {
  return http.get(`${API_URL}/api/tricks`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}

// --- GET /api/trick-tree (T-0201/T-0203, Baum mit Status) ---

/**
 * Test-only mirror of `TrickTreeNode` (schema.d.ts:882-949). Not the wire
 * contract itself - that lives in `schema.d.ts` after `pnpm gen:api` - just
 * enough shape for fixtures and MSW handlers in this ticket's tests.
 */
export interface TrickTreeNodeFixture {
  slug: string;
  name: string;
  category: string;
  difficulty: number;
  isGoal: boolean;
  goalOrder: number | null;
  status: string;
  attemptsTotal: number;
  landedTotal: number;
  successRate: number | null;
  recentSuccessRate: number | null;
  sessionCount: number;
  firstLandedOn: string | null;
  lastPracticedOn: string | null;
}

/** Test-only mirror of `TrickTreeEdge` (schema.d.ts:958-969): from the prerequisite to the dependent trick. */
export interface TrickTreeEdgeFixture {
  from: string;
  to: string;
}

/** Test-only mirror of `TrickPolicyView` (schema.d.ts:734-756). */
export interface TrickPolicyFixture {
  masteryRate: number;
  masterySessions: number;
  masteryMinAttempts: number;
  masteryMode: string;
}

/** Test-only mirror of `TrickTreeResponse` (schema.d.ts:970-981). */
export interface TrickTreeResponseFixture {
  nodes: TrickTreeNodeFixture[];
  edges: TrickTreeEdgeFixture[];
  policy: TrickPolicyFixture;
  generatedAt: string;
}

export function trickTreeNode(
  overrides: Partial<TrickTreeNodeFixture> & Pick<TrickTreeNodeFixture, "slug" | "name">,
): TrickTreeNodeFixture {
  return {
    category: "flat",
    difficulty: 1,
    isGoal: false,
    goalOrder: null,
    status: "bereit",
    attemptsTotal: 0,
    landedTotal: 0,
    successRate: null,
    recentSuccessRate: null,
    sessionCount: 0,
    firstLandedOn: null,
    lastPracticedOn: null,
    ...overrides,
  };
}

/**
 * A mastered root (Ollie), a trick being practiced (50-50), and a locked leaf
 * (Boardslide) that is still missing Ollie as a prerequisite - enough shape
 * for the loading/error/empty/success states and Kriterien 1-13.
 */
export function buildTrickTreeFixture(overrides?: {
  nodes?: TrickTreeNodeFixture[];
  edges?: TrickTreeEdgeFixture[];
  policy?: Partial<TrickPolicyFixture>;
}): TrickTreeResponseFixture {
  const nodes = overrides?.nodes ?? [
    trickTreeNode({
      slug: "ollie",
      name: "Ollie",
      goalOrder: 1,
      isGoal: true,
      status: "sitzt",
      attemptsTotal: 96,
      landedTotal: 21,
      successRate: 0.219,
      lastPracticedOn: "2026-09-06",
    }),
    trickTreeNode({ slug: "50-50", name: "50-50", difficulty: 3, status: "uebe" }),
    trickTreeNode({ slug: "boardslide", name: "Boardslide", difficulty: 5, status: "gesperrt" }),
  ];
  const edges = overrides?.edges ?? [{ from: "ollie", to: "boardslide" }];

  return {
    nodes,
    edges,
    policy: {
      masteryRate: 0.7,
      masterySessions: 3,
      masteryMinAttempts: 15,
      masteryMode: "each_session",
      ...overrides?.policy,
    },
    generatedAt: "2026-09-08T17:41:02+00:00",
  };
}

export function trickTreeHandler(fixture: TrickTreeResponseFixture = buildTrickTreeFixture()) {
  return http.get(`${API_URL}/api/trick-tree`, ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(fixture, { status: 200 });
  });
}

export function trickTreeErrorHandler(status = 500) {
  return http.get(`${API_URL}/api/trick-tree`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}

// --- GET /api/tricks/{slug} (T-0204, Detailseite) ---

/** Test-only mirror of `TrickDetailProgress` (schema.d.ts:632-681). */
export interface TrickDetailProgressFixture {
  status: string;
  attemptsTotal: number;
  landedTotal: number;
  successRate: number | null;
  recentSuccessRate: number | null;
  sessionCount: number;
  firstLandedOn: string | null;
  lastPracticedOn: string | null;
  updatedAt: string;
}

/** Test-only mirror of `TrickRefView` (schema.d.ts:683-699). */
export interface TrickRefViewFixture {
  slug: string;
  name: string;
  status: string;
}

/** Test-only mirror of `TrickHistoryEntry` (schema.d.ts:700-733). */
export interface TrickHistoryEntryFixture {
  sessionId: string;
  sessionDate: string;
  attempts: number;
  landed: number;
  successRate: number | null;
  notes: string | null;
}

/** Test-only mirror of `TrickDetailResponse` (schema.d.ts:757-801). */
export interface TrickDetailResponseFixture {
  slug: string;
  name: string;
  category: string;
  difficulty: number;
  isGoal: boolean;
  goalOrder: number | null;
  description: string | null;
  progress: TrickDetailProgressFixture;
  requires: TrickRefViewFixture[];
  unlocks: TrickRefViewFixture[];
  history: TrickHistoryEntryFixture[];
  policy: TrickPolicyFixture;
}

export function trickRefView(
  overrides: Partial<TrickRefViewFixture> & Pick<TrickRefViewFixture, "slug" | "name">,
): TrickRefViewFixture {
  return { status: "bereit", ...overrides };
}

export function trickHistoryEntry(
  overrides: Partial<TrickHistoryEntryFixture> &
    Pick<TrickHistoryEntryFixture, "sessionId" | "sessionDate">,
): TrickHistoryEntryFixture {
  return {
    attempts: 10,
    landed: 5,
    successRate: 0.5,
    notes: null,
    ...overrides,
  };
}

/**
 * A trick mid-practice ("uebe") with one prerequisite already sitting ("sitzt"),
 * one still-locked unlock, and two history entries in the API's documented
 * order (newest first, schema.d.ts:799) - enough shape for Kriterien 1-7.
 * `TrickDetailScreen` is responsible for reversing this to ascending before
 * handing it to the chart/table (design.md §3) - fixtures stay in wire order
 * so a test that forgets the sort would see it immediately.
 */
export function buildTrickDetailFixture(
  overrides: Partial<TrickDetailResponseFixture> = {},
): TrickDetailResponseFixture {
  return {
    slug: "pop-shove-it",
    name: "Pop Shove-it",
    category: "rotation",
    difficulty: 3,
    isGoal: true,
    goalOrder: 2,
    description: "Board dreht 180 Grad unter dir, Füße bleiben über dem Board.",
    progress: {
      status: "uebe",
      attemptsTotal: 34,
      landedTotal: 12,
      successRate: 0.35,
      recentSuccessRate: 0.5,
      sessionCount: 5,
      firstLandedOn: "2026-08-03",
      lastPracticedOn: "2026-09-06",
      updatedAt: "2026-09-06T18:12:44+00:00",
    },
    requires: [trickRefView({ slug: "ollie", name: "Ollie", status: "sitzt" })],
    unlocks: [trickRefView({ slug: "boardslide", name: "Boardslide", status: "gesperrt" })],
    history: [
      trickHistoryEntry({
        sessionId: "session-2",
        sessionDate: "2026-09-06",
        attempts: 8,
        landed: 4,
        successRate: 0.5,
        notes: null,
      }),
      trickHistoryEntry({
        sessionId: "session-1",
        sessionDate: "2026-08-30",
        attempts: 10,
        landed: 3,
        successRate: 0.3,
        notes: "Regen",
      }),
    ],
    policy: {
      masteryRate: 0.7,
      masterySessions: 3,
      masteryMinAttempts: 15,
      masteryMode: "each_session",
    },
    ...overrides,
  };
}

export function trickDetailHandler(
  fixture: TrickDetailResponseFixture = buildTrickDetailFixture(),
) {
  return http.get(`${API_URL}/api/tricks/${fixture.slug}`, ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(fixture, { status: 200 });
  });
}

export function trickDetailNotFoundHandler(slug: string) {
  return http.get(`${API_URL}/api/tricks/${slug}`, () =>
    HttpResponse.json({ error: "not_found" }, { status: 404 }),
  );
}

export function trickDetailErrorHandler(slug: string, status = 500) {
  return http.get(`${API_URL}/api/tricks/${slug}`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}

// --- GET /api/trick-recommendation (T-0204, Fokus-Karte) ---

/** Test-only mirror of `TrickDosage` (schema.d.ts:802-823). */
export interface TrickDosageFixture {
  attemptsMin: number;
  attemptsMax: number;
  minutesMin: number;
  minutesMax: number;
}

/** Test-only mirror of `TrickSuggestion` (schema.d.ts:824-851). */
export interface TrickSuggestionFixture {
  slug: string;
  name: string;
  status: string;
  reasonCode: string;
  reason: string;
  dosage: TrickDosageFixture;
}

/** Test-only mirror of `PauseHintView` (schema.d.ts:852-863). */
export interface PauseHintFixture {
  code: string;
  message: string;
}

/** Test-only mirror of `TrickRecommendationResponse` (schema.d.ts:864-881). */
export interface TrickRecommendationResponseFixture {
  primary: TrickSuggestionFixture | null;
  secondary: TrickSuggestionFixture[];
  focusLimit: number;
  pauseHint: PauseHintFixture | null;
  generatedAt: string;
}

export function trickSuggestion(
  overrides: Partial<TrickSuggestionFixture> & Pick<TrickSuggestionFixture, "slug" | "name">,
): TrickSuggestionFixture {
  return {
    status: "uebe",
    reasonCode: "almost_landed",
    reason:
      "Du landest diesen Trick schon öfter, aber die Erfolgsquote ist noch nicht über mehrere Einheiten stabil – bleib dran.",
    dosage: { attemptsMin: 15, attemptsMax: 30, minutesMin: 10, minutesMax: 20 },
    ...overrides,
  };
}

/**
 * `primary` present, one `secondary`, no `pauseHint` - the regular case
 * (Kriterium 8). Deliberately synthetic slugs/names ("Fokus-Beispiel …")
 * instead of real catalog tricks like "50-50"/"boardslide": this fixture is
 * the `beforeEach` default in `TrickTreeScreen.test.tsx` (T-0204), so it
 * renders alongside *every* tree fixture in that file - several existing
 * T-0203 tests already use "50-50"/"boardslide" as unrelated tree node
 * names, which made e.g. `screen.getByText("Boardslide")` there ambiguous
 * (the same name appearing once in the tree, once in the focus card).
 * Tests that specifically exercise the tree/recommendation overlap
 * (Kriterium 12) still pass matching slugs explicitly via `overrides`.
 */
export function buildTrickRecommendationFixture(
  overrides: Partial<TrickRecommendationResponseFixture> = {},
): TrickRecommendationResponseFixture {
  return {
    primary: trickSuggestion({ slug: "focus-example-primary", name: "Fokus-Beispiel A" }),
    secondary: [
      trickSuggestion({
        slug: "focus-example-secondary",
        name: "Fokus-Beispiel B",
        reasonCode: "next_ready",
        reason: "Bereit für den nächsten Schritt.",
      }),
    ],
    focusLimit: 2,
    pauseHint: null,
    generatedAt: "2026-09-08T17:41:02+00:00",
    ...overrides,
  };
}

export function trickRecommendationHandler(
  fixture: TrickRecommendationResponseFixture = buildTrickRecommendationFixture(),
) {
  return http.get(`${API_URL}/api/trick-recommendation`, ({ request }) => {
    if (request.headers.get("x-api-key") !== TEST_API_KEY) {
      return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(fixture, { status: 200 });
  });
}

export function trickRecommendationErrorHandler(status = 500) {
  return http.get(`${API_URL}/api/trick-recommendation`, () =>
    HttpResponse.json({ error: "internal_error" }, { status }),
  );
}
