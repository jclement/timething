/**
 * useNow — ticks a Date once per minute so row labels showing "current
 * time in zone" stay fresh without burning CPU on sub-minute updates.
 */

import { useEffect, useState } from "react";

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Align the first tick to the next minute boundary, then tick every 60s.
    const ms = 60_000 - (Date.now() % 60_000);
    const align = window.setTimeout(() => {
      setNow(new Date());
      const iv = window.setInterval(() => setNow(new Date()), 60_000);
      // Clean up via closure
      cleanup = () => window.clearInterval(iv);
    }, ms);
    let cleanup: (() => void) | null = () => window.clearTimeout(align);
    return () => cleanup?.();
  }, []);
  return now;
}
