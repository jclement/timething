/**
 * URL hash ↔ Settings encoding.
 *
 * The full settings object is encoded into the URL hash (not query
 * string — hash stays client-side, doesn't hit any server). Copying
 * the URL is the share mechanism. On load, if a hash is present, it
 * takes precedence over localStorage; the user can then click
 * "Save as default" to persist it.
 *
 * Encoding: JSON → UTF-8 → base64url. Base64url uses [A-Za-z0-9-_]
 * only, so the URL paste-embeds cleanly in emails, Slack, chat, and
 * markdown links — no stray quotes or percent-escapes. A short "v1."
 * prefix tags the format so we can migrate later without guessing.
 */

import type { Settings } from "./storage";

const PREFIX = "v2.";

export function encodeSettingsToHash(settings: Settings): string {
  return PREFIX + base64UrlEncode(JSON.stringify(settings));
}

export function decodeHashToSettings(hashFragment: string): Settings | null {
  let h = hashFragment.startsWith("#") ? hashFragment.slice(1) : hashFragment;
  if (!h) return null;
  if (!h.startsWith(PREFIX)) return null;
  h = h.slice(PREFIX.length);
  try {
    const json = base64UrlDecode(h);
    const parsed = JSON.parse(json) as Partial<Settings>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.zones) ||
      parsed.zones.length === 0
    ) {
      return null;
    }
    return parsed as Settings;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// base64url (UTF-8 safe)
// ---------------------------------------------------------------------------

function base64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  // btoa wants a binary string. Build one from the byte array.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): string {
  const padLen = (4 - (s.length % 4)) % 4;
  const std = (s + "=".repeat(padLen)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(std);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Compare two settings blobs for equality. Used to decide whether the
 * current in-memory state matches what was last persisted.
 */
export function settingsEqual(a: Settings, b: Settings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
