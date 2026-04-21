/**
 * ValidityBar — "this view is correct between these two dates" banner.
 *
 * DST changes silently invalidate the hour grid. This bar surfaces the
 * window around the user's selected reference date:
 *
 *   - `valid from` = latest DST transition across any configured zone
 *     that happened strictly before the reference instant
 *   - `valid through` = last calendar date strictly before the next
 *     DST transition across any configured zone after the reference
 *
 * The bar is also aware that the reference date may be in the past or
 * the future, so the copy works for planning ahead ("this view will be
 * correct until March 8") and looking back ("this view applied through
 * Oct 24 last year").
 *
 * Returns null with a single zone (nothing to line up) or when no zone
 * observes DST in either direction (the grid never drifts).
 */

import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import {
  earliestTransitionAcross,
  instantFromHomeHour,
  latestPreviousTransitionAcross,
  zoneOffsetMinutes,
  type DstTransition,
} from "../lib/time";

export interface LabeledZone {
  tz: string;
  /** Display name as the user sees it in the grid — honours renames. */
  name: string;
}

interface Props {
  /** IANA zone used to pick the calendar date for the bounds. */
  primaryTz: string;
  /** The user-selected reference date, in `YYYY-MM-DD` format. */
  referenceDate: string;
  /** All zones in the order the grid renders them. */
  zones: LabeledZone[];
}

export function ValidityBar({ primaryTz, referenceDate, zones }: Props) {
  // Reference "instant" = noon on the reference date in the primary
  // zone. Any time-of-day works for transition lookups as long as it
  // isn't itself on a transition boundary; noon is never that.
  const refInstant = useMemo(
    () => instantFromHomeHour(primaryTz, referenceDate, 12),
    [primaryTz, referenceDate],
  );

  const tzList = useMemo(() => zones.map((z) => z.tz), [zones]);

  const next = useMemo(
    () => earliestTransitionAcross(tzList, refInstant),
    [tzList, refInstant],
  );
  const prev = useMemo(
    () => latestPreviousTransitionAcross(tzList, refInstant),
    [tzList, refInstant],
  );

  if (zones.length < 2) return null;
  if (!next && !prev) return null;

  const nameOf = (tz: string) => zones.find((z) => z.tz === tz)?.name ?? tz;
  const fmt = (d: Date) => formatCalendarDateInZone(d, primaryTz);

  // "Valid from" = calendar date in the primary zone on which the most
  // recent transition took effect. "Valid through" = day strictly
  // before the upcoming transition in the primary zone's calendar.
  const fromDate = prev ? fmt(prev.transition.after) : null;
  const throughDate = next
    ? fmt(new Date(next.transition.after.getTime() - 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="no-print flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-xs dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-300">
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold">
          {fromDate && throughDate
            ? `Valid ${fromDate} – ${throughDate}.`
            : throughDate
              ? `Valid through ${throughDate}.`
              : fromDate
                ? `Valid from ${fromDate}.`
                : null}
        </div>
        <div className="mt-0.5">
          {next ? (
            <>
              Next: {nameOf(next.tz)}{" "}
              {describeTransition(next.transition)} on {fmt(next.transition.after)}
              .
            </>
          ) : (
            <>No further DST changes across these zones.</>
          )}
        </div>
      </div>
    </div>
  );
}

function describeTransition(t: DstTransition): string {
  const direction = t.deltaMinutes > 0 ? "springs forward" : "falls back";
  return t.abbreviationAfter ? `${direction} to ${t.abbreviationAfter}` : direction;
}

/**
 * Format `instant` as a calendar date ("Sat, Oct 25, 2026") as rendered
 * in `tz`. Uses the same offset-add trick `time.ts` uses elsewhere.
 */
function formatCalendarDateInZone(instant: Date, tz: string): string {
  const offset = zoneOffsetMinutes(instant, tz);
  const local = new Date(instant.getTime() + offset * 60_000);
  return local.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
