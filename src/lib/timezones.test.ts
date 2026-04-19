/**
 * Unit tests for the timezone search index.
 */

import { describe, expect, it } from "vitest";
import { searchZones, humanizeIana } from "./timezones";

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
