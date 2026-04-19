/**
 * ValidityBar — "this view is correct until DATE" banner.
 *
 * DST changes silently invalidate the hour grid (a zone's offset jumps
 * by an hour, so 8am-there no longer lines up with the cell it used to).
 * This bar surfaces the earliest upcoming transition across all
 * configured zones so printed copies and shared links don't quietly go
 * stale.
 *
 * Shown on screen below the grid, and also rendered into the PDF.
 * Returns null if no zone in the set observes DST — then nothing is
 * going to drift anytime soon and the banner would just be noise.
 */

import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { earliestTransitionAcross, zoneOffsetMinutes } from "../lib/time";

export interface LabeledZone {
  tz: string;
  /** Display name as the user sees it in the grid — honours renames. */
  name: string;
}

interface Props {
  /** IANA zone used to pick the calendar date for the "valid through" label. */
  primaryTz: string;
  /** All zones in the order the grid renders them. */
  zones: LabeledZone[];
}

export function ValidityBar({ primaryTz, zones }: Props) {
  const earliest = useMemo(
    () => earliestTransitionAcross(zones.map((z) => z.tz)),
    [zones],
  );
  // Nothing to warn about if you're only looking at one zone — the
  // grid is "valid" as long as you care to use it.
  if (zones.length < 2) return null;
  if (!earliest) return null;

  const { tz, transition } = earliest;
  const zoneName = zones.find((z) => z.tz === tz)?.name ?? tz;
  const direction = transition.deltaMinutes > 0 ? "springs forward" : "falls back";
  const newAbbr = transition.abbreviationAfter;

  // "Valid through" = the calendar date in the primary zone one day
  // before the transition hits. That's the last day the printed copy
  // is correct.
  const oneDay = 24 * 60 * 60 * 1000;
  const lastValidInstant = new Date(transition.after.getTime() - oneDay);
  const primaryOffset = zoneOffsetMinutes(lastValidInstant, primaryTz);
  const localLastValid = new Date(lastValidInstant.getTime() + primaryOffset * 60_000);
  const validThroughStr = localLastValid.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="no-print flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-xs dark:bg-amber-500/[0.06] dark:border-amber-500/20 dark:text-amber-200/90">
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        <span className="font-semibold">Valid through {validThroughStr}.</span>{" "}
        {zoneName} {direction}
        {newAbbr ? <> to {newAbbr}</> : null} after that.
      </span>
    </div>
  );
}
