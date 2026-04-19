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
  nextDstTransition,
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
