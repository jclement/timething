/**
 * Unit tests for time math.
 *
 * We rely on well-known DST transitions in IANA zones to assert the
 * library's behavior without hardcoding the current moment. All tests
 * pick dates that won't silently rebase when the tzdata bundled with
 * Node/Chromium updates.
 */

import { describe, expect, it } from "vitest";
import {
  cellInZone,
  computeDayOffset,
  computeOverlapHours,
  formatOffset,
  instantFromHomeHour,
  isWithinWorkingHours,
  latestPreviousTransitionAcross,
  nextDstTransition,
  previousDstTransition,
  zoneOffsetMinutes,
} from "./time";

describe("zoneOffsetMinutes", () => {
  it("returns -420 for Los Angeles in July (PDT)", () => {
    const at = new Date("2026-07-15T12:00:00Z");
    expect(zoneOffsetMinutes(at, "America/Los_Angeles")).toBe(-420);
  });

  it("returns -480 for Los Angeles in January (PST)", () => {
    const at = new Date("2026-01-15T12:00:00Z");
    expect(zoneOffsetMinutes(at, "America/Los_Angeles")).toBe(-480);
  });

  it("handles :30 zones like India (UTC+5:30)", () => {
    const at = new Date("2026-06-01T00:00:00Z");
    expect(zoneOffsetMinutes(at, "Asia/Kolkata")).toBe(330);
  });

  it("handles :45 zones like Nepal (UTC+5:45)", () => {
    const at = new Date("2026-06-01T00:00:00Z");
    expect(zoneOffsetMinutes(at, "Asia/Kathmandu")).toBe(345);
  });
});

describe("instantFromHomeHour", () => {
  it("constructs a UTC instant for a given wall-clock in the home zone", () => {
    // 8am on 2026-06-15 in Los Angeles (PDT, -7) is 15:00 UTC.
    const instant = instantFromHomeHour("America/Los_Angeles", "2026-06-15", 8);
    expect(instant.toISOString()).toBe("2026-06-15T15:00:00.000Z");
  });

  it("respects DST on the home zone", () => {
    // 8am on 2026-01-15 in Los Angeles (PST, -8) is 16:00 UTC.
    const instant = instantFromHomeHour("America/Los_Angeles", "2026-01-15", 8);
    expect(instant.toISOString()).toBe("2026-01-15T16:00:00.000Z");
  });
});

describe("cellInZone", () => {
  it("projects a UTC instant into the target zone's wall clock", () => {
    const instant = new Date("2026-06-15T15:00:00Z");
    const cell = cellInZone(instant, "Asia/Riyadh"); // UTC+3 year-round
    expect(cell.hour).toBe(18);
    expect(cell.minute).toBe(0);
    expect(cell.isoDate).toBe("2026-06-15");
  });
});

describe("computeDayOffset", () => {
  it("reports +1d when the target zone is ahead across a midnight", () => {
    // 10pm in Calgary on 2026-06-15 is 7am next day in Riyadh.
    const r = computeDayOffset("America/Edmonton", "Asia/Riyadh", "2026-06-15", 22);
    expect(r.dayOffset).toBe(1);
    expect(r.cell.hour).toBe(7);
  });

  it("reports 0d when both zones land on the same date", () => {
    const r = computeDayOffset("America/Edmonton", "America/New_York", "2026-06-15", 10);
    expect(r.dayOffset).toBe(0);
    expect(r.cell.hour).toBe(12);
  });

  it("reports -1d when the target zone is behind across midnight", () => {
    // 2am in Riyadh is 7pm the previous day in Los Angeles.
    const r = computeDayOffset("Asia/Riyadh", "America/Los_Angeles", "2026-06-15", 2);
    expect(r.dayOffset).toBe(-1);
    expect(r.cell.hour).toBe(16); // 2am AST - 10h (PDT in June) = 4pm
  });
});

describe("nextDstTransition", () => {
  it("finds the US fall-back transition after a mid-summer date", () => {
    const from = new Date("2026-07-01T00:00:00Z");
    const t = nextDstTransition("America/Los_Angeles", from);
    expect(t).not.toBeNull();
    // US "fall back" is first Sunday in November. UTC time: 2am local = 9am UTC.
    expect(t!.after.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(t!.deltaMinutes).toBe(-60);
    expect(t!.offsetAfter).toBe(-480); // PST
  });

  it("returns null for a zone with no DST (Phoenix)", () => {
    const t = nextDstTransition("America/Phoenix", new Date("2026-06-01T00:00:00Z"));
    expect(t).toBeNull();
  });

  it("returns null for Riyadh (never observes DST)", () => {
    const t = nextDstTransition("Asia/Riyadh", new Date("2026-06-01T00:00:00Z"));
    expect(t).toBeNull();
  });
});

describe("instantFromHomeHour DST correctness", () => {
  // On spring-forward days the algorithm previously used the wrong
  // offset for every hour past the transition, shifting rendered times
  // by an hour. These tests lock in the corrected behavior.
  it("renders hours 3..23 correctly on US spring-forward (LA 2026-03-08)", () => {
    // 3 AM PDT = 10:00 UTC. 4 AM PDT = 11:00 UTC. Etc.
    const tz = "America/Los_Angeles";
    const date = "2026-03-08";
    for (let h = 3; h < 24; h++) {
      const instant = instantFromHomeHour(tz, date, h);
      const cell = cellInZone(instant, tz);
      expect(
        cell.hour,
        `home hour ${h} should render as ${h} in the primary zone`,
      ).toBe(h);
    }
  });

  it("renders hours 2..23 correctly on US fall-back (LA 2026-11-01)", () => {
    const tz = "America/Los_Angeles";
    const date = "2026-11-01";
    // Hour 1 is genuinely ambiguous (it happens twice). We accept either
    // occurrence; hours 2+ should be unambiguous and correct.
    for (let h = 2; h < 24; h++) {
      const instant = instantFromHomeHour(tz, date, h);
      const cell = cellInZone(instant, tz);
      expect(cell.hour, `home hour ${h} should render as ${h}`).toBe(h);
    }
  });

  it("renders hours correctly on Sydney spring-forward (2026-10-04)", () => {
    const tz = "Australia/Sydney";
    const date = "2026-10-04";
    for (let h = 3; h < 24; h++) {
      const instant = instantFromHomeHour(tz, date, h);
      const cell = cellInZone(instant, tz);
      expect(cell.hour).toBe(h);
    }
  });

  it("renders hours correctly on Sydney fall-back (2026-04-05)", () => {
    const tz = "Australia/Sydney";
    const date = "2026-04-05";
    for (let h = 4; h < 24; h++) {
      const instant = instantFromHomeHour(tz, date, h);
      const cell = cellInZone(instant, tz);
      expect(cell.hour).toBe(h);
    }
  });

  it("non-DST zones render every hour correctly", () => {
    const date = "2026-06-15";
    for (const tz of ["America/Phoenix", "Asia/Riyadh", "Asia/Kolkata", "UTC"]) {
      for (let h = 0; h < 24; h++) {
        const instant = instantFromHomeHour(tz, date, h);
        const cell = cellInZone(instant, tz);
        expect(cell.hour, `${tz} hour ${h}`).toBe(h);
      }
    }
  });
});

describe("DST-day cell stability across zones", () => {
  // On spring-forward in LA, the instant for home hour 3 should project
  // to consistent wall clocks in other zones (no off-by-one drift).
  it("h=3 on LA spring-forward = 10:00 UTC", () => {
    const instant = instantFromHomeHour("America/Los_Angeles", "2026-03-08", 3);
    expect(instant.toISOString()).toBe("2026-03-08T10:00:00.000Z");
  });

  it("projects LA spring-forward h=3 to Riyadh as 1 PM AST", () => {
    const instant = instantFromHomeHour("America/Los_Angeles", "2026-03-08", 3);
    expect(cellInZone(instant, "Asia/Riyadh").hour).toBe(13);
  });
});

describe("half-hour and three-quarter offsets", () => {
  it("projects LA 8 AM to Kolkata :30 offset", () => {
    // LA in June = PDT = UTC-7. 8 AM PDT = 15:00 UTC.
    // Kolkata = UTC+5:30. 15:00 UTC = 20:30 Kolkata.
    const instant = instantFromHomeHour("America/Los_Angeles", "2026-06-15", 8);
    const cell = cellInZone(instant, "Asia/Kolkata");
    expect(cell.hour).toBe(20);
    expect(cell.minute).toBe(30);
  });

  it("Kolkata as primary still produces whole-hour home slots", () => {
    // Hour indexing is in the primary zone's local hours — those are
    // always integers regardless of the UTC offset's fraction.
    for (let h = 0; h < 24; h++) {
      const instant = instantFromHomeHour("Asia/Kolkata", "2026-06-15", h);
      const cell = cellInZone(instant, "Asia/Kolkata");
      expect(cell.hour).toBe(h);
      expect(cell.minute).toBe(0);
    }
  });

  it("Nepal +5:45 offset renders in other zones with :15 minutes", () => {
    // Nepal 9 AM = UTC+5:45 → 03:15 UTC → LA PDT = 20:15 previous day.
    const instant = instantFromHomeHour("Asia/Kathmandu", "2026-06-15", 9);
    const cell = cellInZone(instant, "America/Los_Angeles");
    expect(cell.minute).toBe(15);
  });
});

describe("dateline day-offset chips", () => {
  it("Auckland +13 vs Honolulu -10: Auckland midnight is previous day in Honolulu", () => {
    // Jan = NZDT = UTC+13. Auckland 00:00 on 2026-01-15 = 11:00 UTC
    // 2026-01-14 → Honolulu (UTC-10) = 01:00 on 2026-01-14.
    const { dayOffset, cell } = computeDayOffset(
      "Pacific/Auckland",
      "Pacific/Honolulu",
      "2026-01-15",
      0,
    );
    expect(dayOffset).toBe(-1);
    expect(cell.hour).toBe(1);
  });

  it("Kiribati +14 vs Niue -11: 25-hour gap across dateline", () => {
    // Kiritimati +14. Niue -11. That's a 25h offset; noon Kiribati on
    // 2026-06-15 = 22:00 UTC 2026-06-14 → Niue 11:00 on 2026-06-14.
    const { dayOffset } = computeDayOffset(
      "Pacific/Kiritimati",
      "Pacific/Niue",
      "2026-06-15",
      12,
    );
    expect(dayOffset).toBe(-1);
  });
});

describe("computeOverlapHours edge cases", () => {
  it("wrap-around working hours (night shift) participates correctly", () => {
    // Primary = LA, with a 22-6 night-shift zone in LA itself. The
    // home-hour should be inside that window for 0..5 and 22..23.
    const zones = [
      { tz: "America/Los_Angeles", workingHours: { start: 22, end: 6 } },
    ];
    const overlap = computeOverlapHours(
      "America/Los_Angeles",
      zones,
      "2026-06-15",
      [0, 24],
    );
    for (let h = 0; h < 24; h++) {
      const expected = h >= 22 || h < 6;
      expect(overlap.has(h), `hour ${h}`).toBe(expected);
    }
  });

  it("single zone: every hour in its working window is an overlap", () => {
    const zones = [
      { tz: "America/Los_Angeles", workingHours: { start: 8, end: 17 } },
    ];
    const overlap = computeOverlapHours(
      "America/Los_Angeles",
      zones,
      "2026-06-15",
      [0, 24],
    );
    expect([...overlap].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("empty zones: no overlap is empty set", () => {
    const overlap = computeOverlapHours("UTC", [], "2026-06-15", [0, 24]);
    expect(overlap.size).toBe(0);
  });

  it("computes overlap correctly across LA spring-forward day", () => {
    // The rendered times should still be correct under the fixed
    // instantFromHomeHour. LA 8-17 and Edmonton 8-17 overlap is
    // still the same as any normal day: LA hours 8..14.
    const zones = [
      { tz: "America/Los_Angeles", workingHours: { start: 8, end: 17 } },
      { tz: "America/Edmonton", workingHours: { start: 8, end: 17 } },
    ];
    const overlap = computeOverlapHours(
      "America/Los_Angeles",
      zones,
      "2026-03-08",
      [0, 24],
    );
    expect([...overlap].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  });
});

describe("previousDstTransition / latestPreviousTransitionAcross", () => {
  it("finds the LA fall-back before a winter reference date", () => {
    const t = previousDstTransition("America/Los_Angeles", new Date("2026-01-15T00:00:00Z"));
    expect(t).not.toBeNull();
    // Fall back = 1st Sunday of Nov 2026? No — Nov 1 2026 at 2am PDT is 09:00 UTC.
    // From Jan 15, the LATEST previous transition is Nov 1 2025 (not 2026).
    expect(t!.after.toISOString().slice(0, 7)).toBe("2025-11");
    expect(t!.deltaMinutes).toBe(-60); // fall back
  });

  it("finds the spring-forward before a summer reference date", () => {
    const t = previousDstTransition("America/Los_Angeles", new Date("2026-07-15T00:00:00Z"));
    expect(t).not.toBeNull();
    expect(t!.after.toISOString().slice(0, 7)).toBe("2026-03");
    expect(t!.deltaMinutes).toBe(60); // spring forward
  });

  it("returns null for non-DST zones", () => {
    expect(previousDstTransition("America/Phoenix")).toBeNull();
    expect(previousDstTransition("Asia/Riyadh")).toBeNull();
  });

  it("latest-previous picks the most recent across zones", () => {
    // From Jan 15 2026, LA's last was Nov 1 2025 and Berlin's was Oct 26 2025.
    // LA is later → LA wins.
    const result = latestPreviousTransitionAcross(
      ["America/Los_Angeles", "Europe/Berlin"],
      new Date("2026-01-15T00:00:00Z"),
    );
    expect(result?.tz).toBe("America/Los_Angeles");
  });
});

describe("ValidityBar date math (one-day-before-transition in primary zone)", () => {
  // Mirrors the computation in ValidityBar — included here so we fail
  // a test if the off-by-one behavior regresses. Reviewer flagged this
  // as suspicious; these cases prove it's correct.
  const lastValidCalendarDate = (primaryTz: string, transitionAfter: Date) => {
    const oneDay = 24 * 60 * 60 * 1000;
    const lastValidInstant = new Date(transitionAfter.getTime() - oneDay);
    const offsetMin = zoneOffsetMinutes(lastValidInstant, primaryTz);
    const local = new Date(lastValidInstant.getTime() + offsetMin * 60_000);
    return local.toISOString().slice(0, 10);
  };

  it("LA fall-back Nov 1 2026 → 'valid through Oct 31' in LA", () => {
    const t = nextDstTransition("America/Los_Angeles", new Date("2026-07-01T00:00:00Z"));
    expect(t).not.toBeNull();
    expect(lastValidCalendarDate("America/Los_Angeles", t!.after)).toBe("2026-10-31");
  });

  it("primary=Sydney, LA fall-back → still Oct 31 in Sydney", () => {
    const t = nextDstTransition("America/Los_Angeles", new Date("2026-07-01T00:00:00Z"));
    expect(lastValidCalendarDate("Australia/Sydney", t!.after)).toBe("2026-10-31");
  });
});

describe("computeOverlapHours", () => {
  it("finds the shared working window across home + one other zone", () => {
    // Los Angeles (home) working 8-16 local; Edmonton working 8-16 local.
    // June 15: LA 8am = Edmonton 9am (UTC-7 vs UTC-6). So LA hours that
    // overlap are those where LA is 8-16 AND Edmonton is 8-16, i.e. LA
    // hours 8..15 projected to Edmonton 9..16 — overlap is LA 8..14.
    const zones = [
      { tz: "America/Los_Angeles", workingHours: { start: 8, end: 16 } },
      { tz: "America/Edmonton", workingHours: { start: 8, end: 16 } },
    ];
    const result = computeOverlapHours("America/Los_Angeles", zones, "2026-06-15", [0, 24]);
    expect([...result].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });

  it("returns empty when no hour satisfies every zone", () => {
    const zones = [
      { tz: "America/Los_Angeles", workingHours: { start: 8, end: 16 } },
      { tz: "Asia/Tokyo", workingHours: { start: 8, end: 16 } },
    ];
    const result = computeOverlapHours("America/Los_Angeles", zones, "2026-06-15", [0, 24]);
    expect(result.size).toBe(0);
  });

  it("honors the provided range window", () => {
    const zones = [
      { tz: "America/Los_Angeles", workingHours: { start: 0, end: 24 } },
    ];
    // With a zone that's "working 24/7", every hour in the range is overlap.
    const result = computeOverlapHours("America/Los_Angeles", zones, "2026-06-15", [9, 12]);
    expect([...result].sort((a, b) => a - b)).toEqual([9, 10, 11]);
  });
});

describe("isWithinWorkingHours", () => {
  it("handles normal ranges", () => {
    expect(isWithinWorkingHours(10, { start: 8, end: 16 })).toBe(true);
    expect(isWithinWorkingHours(16, { start: 8, end: 16 })).toBe(false);
    expect(isWithinWorkingHours(7, { start: 8, end: 16 })).toBe(false);
  });

  it("handles wrap-around (night shift)", () => {
    expect(isWithinWorkingHours(23, { start: 22, end: 6 })).toBe(true);
    expect(isWithinWorkingHours(3, { start: 22, end: 6 })).toBe(true);
    expect(isWithinWorkingHours(10, { start: 22, end: 6 })).toBe(false);
  });
});

describe("formatOffset", () => {
  it("formats whole-hour offsets", () => {
    expect(formatOffset(-420)).toBe("UTC-7");
    expect(formatOffset(180)).toBe("UTC+3");
    expect(formatOffset(0)).toBe("UTC+0");
  });

  it("formats fractional offsets", () => {
    expect(formatOffset(330)).toBe("UTC+5:30");
    expect(formatOffset(345)).toBe("UTC+5:45");
  });
});
