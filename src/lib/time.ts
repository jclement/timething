/**
 * Time math for the dashboard.
 *
 * All comparisons happen against a reference date — the "anchor" day in
 * the home time zone that determines which 24 hours we're showing. This
 * matters because of DST: 8am in Calgary maps to different UTC instants
 * in March than it does in December, and the offsets in every other
 * zone can shift too.
 *
 * The input a component hands us is typically:
 *   - homeTz: IANA zone the user treats as "mine"
 *   - referenceDate: a calendar date string (YYYY-MM-DD) in the home tz
 *   - hour: 0-23 in the home zone
 *
 * From that we compute the UTC instant of "referenceDate @ hour:00 in
 * homeTz" and project it into any other zone to get the local wall-clock
 * time for comparison.
 */

export interface CellInstant {
  /** Absolute moment in time. */
  instant: Date;
  /** Hour in the target zone, 0-23. */
  hour: number;
  /** Minute in the target zone, 0-59 (for zones with :30 or :45 offsets). */
  minute: number;
  /** Day shift relative to the reference date in the target zone: -1, 0, +1, +2. */
  dayOffset: number;
  /** ISO date (YYYY-MM-DD) in the target zone. */
  isoDate: string;
}

/**
 * Resolve a home-zone local date + hour to the UTC instant it represents.
 *
 * Uses a two-step offset lookup to handle DST transitions correctly:
 *
 *   1. Guess: treat the requested wall clock as if it were UTC.
 *   2. Offset A: the zone's UTC offset at that guess instant.
 *   3. Candidate: subtract offset A to convert guess into "real" UTC.
 *   4. Offset B: the zone's UTC offset at the candidate.
 *   5. If A and B disagree (transition day), recompute with offset B.
 *
 * Without step 5, every home hour between the transition-hour-as-UTC
 * and the transition-hour-as-local rendered an hour late on DST days.
 *
 * For the "missing hour" on a spring-forward day (e.g., LA 2am on
 * 2026-03-08), there is no UTC instant whose local time is that hour;
 * this function returns the pre-transition boundary, which will render
 * as the preceding hour. Callers that care can detect this by checking
 * whether the result's wall-clock hour actually equals the requested
 * hour.
 */
export function instantFromHomeHour(homeTz: string, referenceDateIso: string, hour: number): Date {
  const [y, m, d] = referenceDateIso.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, 0, 0);
  const offsetA = zoneOffsetMinutes(new Date(guess), homeTz);
  const candidate = new Date(guess - offsetA * 60_000);
  const offsetB = zoneOffsetMinutes(candidate, homeTz);
  if (offsetA === offsetB) return candidate;
  // Transition day — recompute using the offset that actually applies
  // at the resulting instant, which lines up the rest of the day.
  return new Date(guess - offsetB * 60_000);
}

/**
 * Project a UTC instant into a target zone's wall clock.
 */
export function cellInZone(instant: Date, tz: string): CellInstant {
  const parts = wallClockParts(instant, tz);
  return {
    instant,
    hour: parts.hour,
    minute: parts.minute,
    dayOffset: 0, // caller fills this in relative to the reference date
    isoDate: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
  };
}

/**
 * Offset of `tz` relative to UTC, in minutes, at `instant`.
 * Positive east of UTC. E.g. Calgary in winter = -420 (UTC-7).
 */
export function zoneOffsetMinutes(instant: Date, tz: string): number {
  const local = wallClockParts(instant, tz);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const _partsFormatterCache = new Map<string, Intl.DateTimeFormat>();
function wallClockParts(instant: Date, tz: string): WallClockParts {
  let fmt = _partsFormatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    _partsFormatterCache.set(tz, fmt);
  }
  const parts = fmt.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24, // "24" is emitted for midnight in some locales
    minute: get("minute"),
    second: get("second"),
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// ---------------------------------------------------------------------------
// Day boundary detection
// ---------------------------------------------------------------------------

/**
 * Given a reference date in the home zone and a hour 0-23, produce the
 * day offset in the target zone. Used to annotate cells that cross into
 * "tomorrow" or "yesterday".
 */
export function computeDayOffset(
  homeTz: string,
  targetTz: string,
  referenceDateIso: string,
  hour: number,
): { dayOffset: number; targetIsoDate: string; cell: CellInstant } {
  const instant = instantFromHomeHour(homeTz, referenceDateIso, hour);
  const cell = cellInZone(instant, targetTz);
  const dayOffset = daysBetweenIso(referenceDateIso, cell.isoDate);
  return { dayOffset, targetIsoDate: cell.isoDate, cell: { ...cell, dayOffset } };
}

function daysBetweenIso(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const at = Date.UTC(ay, am - 1, ad);
  const bt = Date.UTC(by, bm - 1, bd);
  return Math.round((bt - at) / 86_400_000);
}

// ---------------------------------------------------------------------------
// DST transition lookup
// ---------------------------------------------------------------------------

export interface DstTransition {
  tz: string;
  /** UTC instant just before the transition. */
  before: Date;
  /** UTC instant just after the transition. */
  after: Date;
  /** Offset in minutes before the transition. */
  offsetBefore: number;
  /** Offset in minutes after the transition. */
  offsetAfter: number;
  /** Delta in minutes (positive = spring forward, negative = fall back). */
  deltaMinutes: number;
  /** Human label for the new offset, e.g. "MDT (UTC-6)". */
  abbreviationAfter: string;
}

/**
 * Find the next DST transition within `lookaheadDays` of `from`. Returns
 * null if the zone has no DST change in that window (e.g. Arizona,
 * Saudi Arabia, India).
 *
 * Implementation: scan day-by-day and look at each day's UTC offset.
 * When it changes, binary-search within that day to pinpoint the hour.
 * Cheap enough to run on render for a handful of zones.
 */
export function nextDstTransition(
  tz: string,
  from: Date = new Date(),
  lookaheadDays = 400,
): DstTransition | null {
  const startOffset = zoneOffsetMinutes(from, tz);
  const stepMs = 86_400_000;

  for (let i = 1; i <= lookaheadDays; i++) {
    const at = new Date(from.getTime() + i * stepMs);
    const atOffset = zoneOffsetMinutes(at, tz);
    if (atOffset !== startOffset) {
      // The boundary is between (at - 1 day) and at. Narrow it to the hour.
      return narrowTransition(tz, new Date(at.getTime() - stepMs), at);
    }
  }
  return null;
}

function narrowTransition(tz: string, lo: Date, hi: Date): DstTransition {
  const loOffset = zoneOffsetMinutes(lo, tz);
  // Bisect until within 60 seconds.
  while (hi.getTime() - lo.getTime() > 60_000) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    if (zoneOffsetMinutes(mid, tz) === loOffset) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const offsetBefore = zoneOffsetMinutes(lo, tz);
  const offsetAfter = zoneOffsetMinutes(hi, tz);
  return {
    tz,
    before: lo,
    after: hi,
    offsetBefore,
    offsetAfter,
    deltaMinutes: offsetAfter - offsetBefore,
    abbreviationAfter: abbreviationAt(tz, hi),
  };
}

/**
 * Across a set of zones, return the earliest upcoming DST transition.
 *
 * "The grid stays correct until this date" — that's the signal we need
 * to warn the user that their printed copy (or shared URL) will stop
 * lining up. Returns null if none of the zones observe DST in the
 * lookahead window.
 */
export function earliestTransitionAcross(
  tzs: string[],
  from: Date = new Date(),
  lookaheadDays = 400,
): { tz: string; transition: DstTransition } | null {
  const seen = new Set<string>();
  let winner: { tz: string; transition: DstTransition } | null = null;
  for (const tz of tzs) {
    if (seen.has(tz)) continue;
    seen.add(tz);
    const t = nextDstTransition(tz, from, lookaheadDays);
    if (!t) continue;
    if (!winner || t.after.getTime() < winner.transition.after.getTime()) {
      winner = { tz, transition: t };
    }
  }
  return winner;
}

/**
 * Mirror of nextDstTransition but walking backwards — the most recent
 * transition STRICTLY BEFORE `from`. Used by ValidityBar to show
 * "valid from" when the user is scrubbing a date in the past or future.
 */
export function previousDstTransition(
  tz: string,
  from: Date = new Date(),
  lookbackDays = 400,
): DstTransition | null {
  const endOffset = zoneOffsetMinutes(from, tz);
  const stepMs = 86_400_000;

  for (let i = 1; i <= lookbackDays; i++) {
    const at = new Date(from.getTime() - i * stepMs);
    const atOffset = zoneOffsetMinutes(at, tz);
    if (atOffset !== endOffset) {
      // Transition is between `at` and the previous day scanned.
      return narrowTransition(tz, at, new Date(at.getTime() + stepMs));
    }
  }
  return null;
}

/**
 * Across a set of zones, return the *latest* transition strictly before
 * `from`. That's the start of the window during which the grid is
 * correct — any earlier DST event is stale. Returns null if none of
 * the zones transitioned in the lookback window.
 */
export function latestPreviousTransitionAcross(
  tzs: string[],
  from: Date = new Date(),
  lookbackDays = 400,
): { tz: string; transition: DstTransition } | null {
  const seen = new Set<string>();
  let winner: { tz: string; transition: DstTransition } | null = null;
  for (const tz of tzs) {
    if (seen.has(tz)) continue;
    seen.add(tz);
    const t = previousDstTransition(tz, from, lookbackDays);
    if (!t) continue;
    if (!winner || t.after.getTime() > winner.transition.after.getTime()) {
      winner = { tz, transition: t };
    }
  }
  return winner;
}

function abbreviationAt(tz: string, at: Date): string {
  // Mirror zoneAbbreviation in timezones.ts: UTC offset always, with
  // a named short-name appended in parens when Intl knows one. Keeps
  // the DST footnotes, ValidityBar, and zone labels in lock step.
  const offset = formatOffset(zoneOffsetMinutes(at, tz));
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(at);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    if (/^[A-Z]{2,6}$/.test(raw)) return `${offset} (${raw})`;
  } catch {
    // ignore
  }
  return offset;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** "Apr 18, 2026" — for reference date labels. */
export function formatLongDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Sat" — short weekday for the reference date in the given zone. */
export function weekdayShort(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "short" }).format(instant);
}

/**
 * Format an offset in minutes as "UTC+5:30" or "UTC-7".
 */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${pad(m)}`;
}

/** Today in the given zone, formatted as YYYY-MM-DD. */
export function todayInZone(tz: string): string {
  const parts = wallClockParts(new Date(), tz);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

// ---------------------------------------------------------------------------
// Overlap computation
// ---------------------------------------------------------------------------

export interface OverlapZone {
  /** IANA zone. */
  tz: string;
  /** Effective working hours for this zone. */
  workingHours: { start: number; end: number };
}

/**
 * Given the set of zones (including home), return the set of home-zone
 * hours where EVERY zone is within its configured working hours.
 *
 * This is the "everyone's available" signal. The hour is the home-zone
 * hour (0-23) — callers map it back to cells for rendering.
 */
export function computeOverlapHours(
  homeTz: string,
  zones: OverlapZone[],
  referenceDateIso: string,
  range: [number, number],
): Set<number> {
  const result = new Set<number>();
  // Vacuous-truth guard: "every zone is working" is trivially true with
  // zero zones, which would tint every hour. Prefer empty in that case.
  if (zones.length === 0) return result;
  for (let h = range[0]; h < range[1]; h++) {
    let allOverlap = true;
    for (const zone of zones) {
      const cell = computeDayOffset(homeTz, zone.tz, referenceDateIso, h);
      if (!isWithinWorkingHours(cell.cell.hour, zone.workingHours)) {
        allOverlap = false;
        break;
      }
    }
    if (allOverlap) result.add(h);
  }
  return result;
}

/** Shared helper — also used inside zone rows to avoid divergence. */
export function isWithinWorkingHours(
  hour: number,
  wh: { start: number; end: number },
): boolean {
  if (wh.start <= wh.end) return hour >= wh.start && hour < wh.end;
  // Wraparound (e.g., 22-6). Treat as "hour >= start OR hour < end".
  return hour >= wh.start || hour < wh.end;
}

/** "8:30 AM" / "20:00" — format an hour + minute for display. */
export function formatHour(hour: number, minute: number, use24h: boolean): string {
  if (use24h) {
    // Compact 24h form: "08h", "19h". Only pull in minutes for zones
    // with :30 or :45 offsets, where the cell doesn't fall on the hour.
    return minute === 0 ? `${pad(hour)}h` : `${pad(hour)}:${pad(minute)}`;
  }
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  return minute === 0 ? `${h12} ${ampm}` : `${h12}:${pad(minute)} ${ampm}`;
}
