/**
 * DstFootnotes — print-only summary of each zone's next DST transition.
 *
 * Shown beneath the grid when printing so the paper copy reminds the
 * reader when a zone's offset is about to shift (and what the new
 * abbreviation will be).
 */

import { useMemo } from "react";
import { formatOffset, nextDstTransition, zoneOffsetMinutes } from "../lib/time";
import { firstCityForTz, humanizeIana, zoneAbbreviation } from "../lib/timezones";
import type { ZoneConfig } from "../lib/storage";

interface Props {
  homeTz: string;
  zones: ZoneConfig[];
}

export function DstFootnotes({ homeTz, zones }: Props) {
  const entries = useMemo(() => {
    const tzs = [homeTz, ...zones.map((z) => z.tz)];
    const seen = new Set<string>();
    return tzs
      .filter((tz) => (seen.has(tz) ? false : (seen.add(tz), true)))
      .map((tz) => {
        const transition = nextDstTransition(tz);
        const now = new Date();
        const currentAbbr = zoneAbbreviation(tz, now);
        const currentOffset = zoneOffsetMinutes(now, tz);
        const city = firstCityForTz(tz);
        return {
          tz,
          display: city?.name ?? humanizeIana(tz),
          country: city?.country,
          currentAbbr,
          currentOffset,
          transition,
        };
      });
  }, [homeTz, zones]);

  return (
    <section className="print-only mt-6 text-xs text-[#111827]">
      <h2 className="font-semibold text-sm mb-2 border-b border-[#d1d5db] pb-1">
        Daylight saving time — next transitions
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
        {entries.map((e) => (
          <div key={e.tz} className="flex items-start justify-between gap-4 py-0.5">
            <dt className="truncate">
              <span className="font-medium">{e.display}</span>
              {e.country && <span className="text-[#4b5563]"> · {e.country}</span>}
              <span className="font-mono text-[#4b5563]">
                {" "}
                ({e.currentAbbr || formatOffset(e.currentOffset)})
              </span>
            </dt>
            <dd className="font-mono whitespace-nowrap text-[#374151]">
              {e.transition ? (
                <>
                  {e.transition.deltaMinutes > 0 ? "Spring forward" : "Fall back"}{" "}
                  {e.transition.after.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  → {e.transition.abbreviationAfter || formatOffset(e.transition.offsetAfter)}
                </>
              ) : (
                <>No DST — fixed at {formatOffset(e.currentOffset)}</>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
