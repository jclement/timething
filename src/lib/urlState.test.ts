/**
 * Unit tests for URL hash encoding. These guard the invariant that
 * shared links stay base64url-clean — no quotes or percent-escapes
 * leaking into the URL.
 */

import { describe, expect, it } from "vitest";
import { decodeHashToSettings, encodeSettingsToHash } from "./urlState";
import type { Settings } from "./storage";

const SAMPLE: Settings = {
  version: 1,
  homeTz: "America/Edmonton",
  homeLabel: "Jeff",
  zones: [
    { id: "a", tz: "Asia/Riyadh", label: "Dhahran" },
    { id: "b", tz: "America/Chicago", label: "Houston", workingHours: { start: 9, end: 18 } },
  ],
  defaultWorkingHours: { start: 8, end: 17 },
  use24h: false,
  theme: "system",
  rangeKey: "waking",
};

describe("encodeSettingsToHash / decodeHashToSettings", () => {
  it("round-trips losslessly", () => {
    const encoded = encodeSettingsToHash(SAMPLE);
    const decoded = decodeHashToSettings(encoded);
    expect(decoded).toEqual(SAMPLE);
  });

  it("produces a URL-safe string (no quotes, no percent-escapes)", () => {
    const encoded = encodeSettingsToHash(SAMPLE);
    expect(encoded).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
  });

  it("accepts a hash with leading #", () => {
    const encoded = encodeSettingsToHash(SAMPLE);
    expect(decodeHashToSettings(`#${encoded}`)).toEqual(SAMPLE);
  });

  it("returns null for an empty hash", () => {
    expect(decodeHashToSettings("")).toBeNull();
    expect(decodeHashToSettings("#")).toBeNull();
  });

  it("returns null for a hash without the v1 prefix", () => {
    expect(decodeHashToSettings("garbage")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(decodeHashToSettings("v1.!!!not-base64!!!")).toBeNull();
  });

  it("handles unicode city labels", () => {
    const s: Settings = { ...SAMPLE, homeLabel: "São Paulo — 日本 ✈️" };
    const round = decodeHashToSettings(encodeSettingsToHash(s));
    expect(round?.homeLabel).toBe("São Paulo — 日本 ✈️");
  });
});
