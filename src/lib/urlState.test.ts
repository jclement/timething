/**
 * Unit tests for URL hash encoding. These guard the invariant that
 * shared links stay base64url-clean — no quotes or percent-escapes
 * leaking into the URL.
 */

import { describe, expect, it } from "vitest";
import { decodeHashToSettings, encodeSettingsToHash } from "./urlState";
import type { Settings } from "./storage";

const SAMPLE: Settings = {
  version: 2,
  zones: [
    {
      id: "a",
      tz: "America/Edmonton",
      label: "Jeff",
      workingHours: { start: 8, end: 17 },
    },
    {
      id: "b",
      tz: "Asia/Riyadh",
      label: "Dhahran",
      workingHours: { start: 9, end: 18 },
    },
  ],
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
    expect(encoded).toMatch(/^v2\.[A-Za-z0-9_-]+$/);
  });

  it("accepts a hash with leading #", () => {
    const encoded = encodeSettingsToHash(SAMPLE);
    expect(decodeHashToSettings(`#${encoded}`)).toEqual(SAMPLE);
  });

  it("returns null for an empty hash", () => {
    expect(decodeHashToSettings("")).toBeNull();
    expect(decodeHashToSettings("#")).toBeNull();
  });

  it("returns null for a hash without the v2 prefix", () => {
    expect(decodeHashToSettings("garbage")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(decodeHashToSettings("v2.!!!not-base64!!!")).toBeNull();
  });

  it("handles unicode city labels", () => {
    const s: Settings = {
      ...SAMPLE,
      zones: [{ ...SAMPLE.zones[0], label: "São Paulo — 日本 ✈️" }, SAMPLE.zones[1]],
    };
    const round = decodeHashToSettings(encodeSettingsToHash(s));
    expect(round?.zones[0]?.label).toBe("São Paulo — 日本 ✈️");
  });
});
