import { describe, expect, it } from "vitest";
import {
  CONTEST_LOCATION,
  daysUntilContest,
  formatContestCountdown,
  formatContestCountdownShort,
  formatContestDate,
} from "./contest";

describe("daysUntilContest", () => {
  it("counts calendar days from today until 18 September 2027", () => {
    expect(daysUntilContest(new Date(2026, 8, 7))).toBe(376);
  });

  it("ignores the time of day", () => {
    expect(daysUntilContest(new Date(2027, 8, 17, 23, 59, 59))).toBe(1);
    expect(daysUntilContest(new Date(2027, 8, 17, 0, 0, 1))).toBe(1);
  });

  it("is zero on contest day", () => {
    expect(daysUntilContest(new Date(2027, 8, 18, 15, 30))).toBe(0);
  });

  it("goes negative after the contest", () => {
    expect(daysUntilContest(new Date(2027, 8, 20))).toBe(-2);
  });
});

describe("formatContestDate", () => {
  it("uses the German long date format", () => {
    expect(formatContestDate()).toBe("18. September 2027");
    expect(CONTEST_LOCATION).toBe("Braunschweig");
  });
});

describe("formatContestCountdown", () => {
  it("phrases the remaining days in German", () => {
    expect(formatContestCountdown(376)).toBe("Noch 376 Tage bis zum Contest");
    expect(formatContestCountdown(1)).toBe("Noch 1 Tag bis zum Contest");
    expect(formatContestCountdown(0)).toBe("Heute ist Contest!");
    expect(formatContestCountdown(-1)).toBe("Der Contest war vor 1 Tag");
    expect(formatContestCountdown(-3)).toBe("Der Contest war vor 3 Tagen");
  });

  it("has a compact variant for the header", () => {
    expect(formatContestCountdownShort(376)).toBe("Noch 376 Tage");
    expect(formatContestCountdownShort(1)).toBe("Noch 1 Tag");
    expect(formatContestCountdownShort(0)).toBe("Heute!");
    expect(formatContestCountdownShort(-5)).toBe("Vorbei");
  });
});
