/**
 * useSettings — React state wrapper for the app's settings blob.
 *
 * Persistence model (deliberately explicit, no magic auto-save):
 *
 *   • In-memory state is mirrored to the URL hash on every change
 *     (history.replaceState, so no history spam). The URL is the
 *     ephemeral "what you're looking at right now."
 *
 *   • localStorage is the "default" — the zone set you come back to
 *     when you open the app fresh. It ONLY updates when the user
 *     explicitly clicks "Save as default."
 *
 *   • On load: if a hash is present, it wins. Otherwise we start from
 *     localStorage (or the built-in defaults if none).
 *
 *   • `needsSave` is true whenever the live state differs from what's
 *     persisted. The Dashboard uses this to show the Save banner.
 */

import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings, type Settings } from "../lib/storage";
import { decodeHashToSettings, encodeSettingsToHash, settingsEqual } from "../lib/urlState";

export function useSettings() {
  const [persisted, setPersisted] = useState<Settings>(() => loadSettings());
  const [settings, setSettings] = useState<Settings>(() => {
    const fromUrl = decodeHashToSettings(window.location.hash);
    return fromUrl ?? loadSettings();
  });

  // Mirror current state into the URL hash every time it changes.
  useEffect(() => {
    const target = `#${encodeSettingsToHash(settings)}`;
    if (window.location.hash !== target) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${target}`,
      );
    }
  }, [settings]);

  const update = useCallback((fn: (prev: Settings) => Settings) => {
    setSettings((prev) => fn(prev));
  }, []);

  const saveAsDefault = useCallback(() => {
    saveSettings(settings);
    setPersisted(settings);
  }, [settings]);

  const resetToDefault = useCallback(() => {
    setSettings(persisted);
  }, [persisted]);

  const needsSave = !settingsEqual(settings, persisted);

  return { settings, setSettings, update, saveAsDefault, resetToDefault, needsSave };
}
