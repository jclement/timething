/**
 * Unit tests for the timezone search index.
 */

import { describe, expect, it } from "vitest";
import { humanizeIana, resolveZoneName, searchZones, zoneAbbreviation } from "./timezones";

describe("searchZones", () => {
  it("finds Houston by city name", () => {
    const hits = searchZones("houston");
    expect(hits[0]?.label).toMatch(/Houston/);
    expect(hits[0]?.tz).toBe("America/Chicago");
  });

  it("finds Calgary by city name", () => {
    const hits = searchZones("calg");
    expect(hits[0]?.label).toMatch(/Calgary/);
    expect(hits[0]?.tz).toBe("America/Edmonton");
  });

  it("matches by abbreviation", () => {
    const hits = searchZones("CST");
    // Multiple cities share CST — we just assert at least one valid hit.
    expect(hits.length).toBeGreaterThan(0);
  });

  it("matches by country", () => {
    const hits = searchZones("saudi");
    expect(hits.some((h) => /Riyadh|Jeddah|Dhahran/.test(h.label))).toBe(true);
  });

  it("matches by IANA name directly", () => {
    const hits = searchZones("Pacific/Auck");
    expect(hits.some((h) => h.tz === "Pacific/Auckland")).toBe(true);
  });

  it("returns empty on empty query", () => {
    expect(searchZones("")).toEqual([]);
  });

  it("ranks exact city name above substrings", () => {
    const hits = searchZones("tokyo");
    expect(hits[0]?.tz).toBe("Asia/Tokyo");
  });

  it("carries the specific city name on the hit so Houston != Chicago", () => {
    const hit = searchZones("houston")[0];
    expect(hit?.name).toBe("Houston");
    expect(hit?.tz).toBe("America/Chicago");
  });

  it("carries the specific city name on Edmonton hits", () => {
    const hit = searchZones("edmonton")[0];
    expect(hit?.name).toBe("Edmonton");
    expect(hit?.tz).toBe("America/Edmonton");
  });
});

describe("humanizeIana", () => {
  it("formats multi-segment zones", () => {
    expect(humanizeIana("America/Argentina/Buenos_Aires")).toBe("Buenos Aires · America");
  });

  it("handles single-segment zones", () => {
    expect(humanizeIana("UTC")).toBe("UTC");
  });
});

describe("zoneAbbreviation (reference-date-aware)", () => {
  // Every result begins with UTC±N. Named Intl abbreviations — when
  // available — appear in parens. Kolkata has no named abbreviation in
  // Chrome's CLDR (falls back to "GMT+5:30"), so we suppress the
  // parens entirely and show just "UTC+5:30".

  it("reflects DST state from the provided date — summer", () => {
    const julyNoon = new Date("2026-07-15T12:00:00Z");
    const s = zoneAbbreviation("America/New_York", julyNoon);
    expect(s).toMatch(/^UTC-4/);
  });

  it("reflects DST state from the provided date — winter", () => {
    const januaryNoon = new Date("2026-01-15T12:00:00Z");
    const s = zoneAbbreviation("America/New_York", januaryNoon);
    expect(s).toMatch(/^UTC-5/);
  });

  it("uses UTC offset only for zones without named abbreviations", () => {
    const s = zoneAbbreviation("Asia/Kolkata", new Date("2026-06-15T00:00:00Z"));
    // Kolkata's Intl short name is "GMT+5:30" which is generic, so we
    // drop it. Output is just the UTC offset.
    expect(s).toBe("UTC+5:30");
  });

  it("uses UTC offset only for non-DST whole-hour zones", () => {
    // Riyadh Intl returns "GMT+3" generic. We collapse to plain offset.
    const s = zoneAbbreviation("Asia/Riyadh", new Date("2026-06-15T00:00:00Z"));
    expect(s).toBe("UTC+3");
  });

  it("handles :45 offsets", () => {
    const s = zoneAbbreviation("Asia/Kathmandu", new Date("2026-06-15T00:00:00Z"));
    expect(s).toBe("UTC+5:45");
  });

  it("picks summer vs winter offset for Sydney (southern hemisphere)", () => {
    // Sydney is on AEDT (+11) in Jan and AEST (+10) in Jul — reversed
    // from northern-hemisphere DST.
    const jan = zoneAbbreviation("Australia/Sydney", new Date("2026-01-15T00:00:00Z"));
    const jul = zoneAbbreviation("Australia/Sydney", new Date("2026-07-15T00:00:00Z"));
    expect(jan).toMatch(/^UTC\+11/);
    expect(jul).toMatch(/^UTC\+10/);
  });
});

describe("resolveZoneName", () => {
  it("prefers an explicit homeLabelOverride", () => {
    expect(resolveZoneName({ tz: "America/Edmonton", label: "Calgary" }, "Jeff")).toBe(
      "Jeff",
    );
  });

  it("falls back to zone label when no override", () => {
    expect(resolveZoneName({ tz: "America/Edmonton", label: "Calgary" })).toBe("Calgary");
  });

  it("falls back to the curated city name", () => {
    expect(resolveZoneName({ tz: "America/Edmonton" })).toBe("Calgary");
  });

  it("falls back to a humanized IANA for unknown zones", () => {
    expect(resolveZoneName({ tz: "Antarctica/Troll" })).toBe("Troll · Antarctica");
  });
});
