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
