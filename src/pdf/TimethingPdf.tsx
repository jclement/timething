/**
 * TimethingPdf — vector PDF rendering of the dashboard via @react-pdf/renderer.
 *
 * Landscape letter, one row per zone with the same hour axis as the
 * screen, color-coded cells for working hours, +1d / -1d chips for
 * day-boundary cells, and a footer summarizing each zone's next DST
 * transition.
 *
 * This deliberately mirrors what's on screen — the user should get
 * something that looks like a printed version of the page, not a raw
 * data dump.
 */

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  computeDayOffset,
  computeOverlapHours,
  earliestTransitionAcross,
  formatHour,
  formatLongDate,
  formatOffset,
  nextDstTransition,
  zoneOffsetMinutes,
} from "../lib/time";
import type { Settings, ZoneConfig, WorkingHours } from "../lib/storage";
import {
  firstCityForTz,
  humanizeIana,
  resolveZoneName,
  zoneAbbreviation,
} from "../lib/timezones";

interface Props {
  settings: Settings;
  referenceDate: string;
  range: [number, number];
}

// Row palette — mirrors the --zone-N CSS vars in app.css so the PDF and
// screen look the same. Each zone row takes the color at (i % palette.length).
const ZONE_COLORS = [
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#dc2626",
  "#0d9488",
];

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "1pt solid #d1d5db",
    paddingBottom: 6,
    marginBottom: 10,
  },
  brand: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6b7280",
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
  },
  headerRight: {
    fontSize: 8,
    color: "#4b5563",
    textAlign: "right",
  },

  gridContainer: {
    border: "1pt solid #e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },

  hourAxis: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottom: "1pt solid #d1d5db",
  },
  axisLabel: {
    width: 110,
    padding: 4,
    fontSize: 7,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6b7280",
    fontWeight: 700,
  },
  axisHours: {
    flex: 1,
    flexDirection: "row",
  },
  axisHour: {
    flex: 1,
    paddingVertical: 4,
    borderLeft: "1pt solid #e5e7eb",
    fontSize: 7,
    textAlign: "center",
    color: "#4b5563",
  },

  row: {
    flexDirection: "row",
    borderBottom: "1pt solid #e5e7eb",
  },
  rowLast: {
    flexDirection: "row",
  },
  labelCol: {
    width: 130,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRight: "1pt solid #e5e7eb",
    flexDirection: "column",
  },
  labelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  swatch: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  labelText: {
    flex: 1,
    fontSize: 9,
    fontWeight: 700,
    color: "#111827",
    lineHeight: 1.2,
  },
  labelMeta: {
    fontSize: 7,
    color: "#6b7280",
    marginTop: 2,
    lineHeight: 1.2,
  },
  cellsRow: {
    flex: 1,
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    minHeight: 26,
    borderLeft: "1pt solid #e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
  },
  cellBoundary: {
    borderLeft: "1.5pt solid #9ca3af",
  },
  overlapStripe: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: "#16a34a",
  },
  overlapCell: {
    backgroundColor: "#dcfce7",
  },
  axisOverlap: {
    color: "#15803d",
    fontWeight: 700,
  },
  cellText: {
    fontSize: 7,
    textAlign: "center",
    color: "#4b5563",
  },
  cellTextWork: {
    fontWeight: 700,
    color: "#111827",
  },
  dayChip: {
    marginTop: 1,
    fontSize: 5,
    paddingHorizontal: 2,
    paddingVertical: 0.5,
    borderRadius: 1,
  },
  dayChipAhead: {
    backgroundColor: "#fef3c7",
    color: "#78350f",
  },
  dayChipBehind: {
    backgroundColor: "#e0e7ff",
    color: "#312e81",
  },

  dstSection: {
    marginTop: 10,
    fontSize: 8,
  },
  validityBar: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#fef3c7",
    border: "1pt solid #fde68a",
    borderRadius: 2,
    fontSize: 8,
    color: "#78350f",
  },
  validityBold: {
    fontWeight: 700,
  },
  dstHeading: {
    fontSize: 9,
    fontWeight: 700,
    borderBottom: "1pt solid #d1d5db",
    paddingBottom: 3,
    marginBottom: 4,
  },
  dstRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    gap: 12,
  },
  dstLabel: {
    flex: 1,
  },
  dstValue: {
    fontSize: 7,
    color: "#374151",
  },
  dstMono: {
    fontFamily: "Courier",
  },

  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#9ca3af",
  },
});

export function TimethingPdf({ settings, referenceDate, range }: Props) {
  const allZones: ZoneConfig[] = [
    { id: "__home__", tz: settings.homeTz, label: settings.homeLabel },
    ...settings.zones,
  ];
  const hours: number[] = [];
  for (let h = range[0]; h < range[1]; h++) hours.push(h);

  const homeCity = firstCityForTz(settings.homeTz);
  const homeName = settings.homeLabel ?? homeCity?.name ?? humanizeIana(settings.homeTz);

  // Home hours where every zone is in its working window — rendered as
  // a green band across the grid, matching the on-screen affordance.
  const overlapHours = computeOverlapHours(
    settings.homeTz,
    allZones.map((z) => ({
      tz: z.tz,
      workingHours: z.workingHours ?? settings.defaultWorkingHours,
    })),
    referenceDate,
    range,
  );

  return (
    <Document
      title={`timething — ${formatLongDate(referenceDate)}`}
      author="timething"
      subject="Time zone comparison"
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>timething</Text>
            <Text style={styles.title}>Meeting times — {formatLongDate(referenceDate)}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text>Home: {homeName}</Text>
            <Text>{settings.homeTz}</Text>
          </View>
        </View>

        <View style={styles.gridContainer}>
          {/* Hour axis */}
          <View style={styles.hourAxis}>
            <Text style={styles.axisLabel}>Home hour</Text>
            <View style={styles.axisHours}>
              {hours.map((h) => (
                <Text
                  key={h}
                  style={[styles.axisHour, overlapHours.has(h) ? styles.axisOverlap : {}]}
                >
                  {labelForHomeHour(h, settings.use24h)}
                </Text>
              ))}
            </View>
          </View>

          {/* Zone rows */}
          {allZones.map((zone, i) => (
            <ZoneRow
              key={zone.id}
              zone={zone}
              isLast={i === allZones.length - 1}
              isHome={zone.id === "__home__"}
              homeTz={settings.homeTz}
              homeLabel={settings.homeLabel}
              referenceDate={referenceDate}
              hours={hours}
              use24h={settings.use24h}
              workingHours={zone.workingHours ?? settings.defaultWorkingHours}
              color={ZONE_COLORS[i % ZONE_COLORS.length]}
              overlapHours={overlapHours}
            />
          ))}
        </View>

        <PdfValidityBar
          homeTz={settings.homeTz}
          homeLabel={settings.homeLabel}
          zones={settings.zones}
        />

        <DstSection homeTz={settings.homeTz} zones={settings.zones} />

        <View style={styles.footer} fixed>
          <Text>timething · {new Date().toLocaleString()}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Zone row
// ---------------------------------------------------------------------------

function ZoneRow({
  zone,
  isLast,
  isHome,
  homeTz,
  homeLabel,
  referenceDate,
  hours,
  use24h,
  workingHours,
  color,
  overlapHours,
}: {
  zone: ZoneConfig;
  isLast: boolean;
  isHome: boolean;
  homeTz: string;
  homeLabel?: string;
  referenceDate: string;
  hours: number[];
  use24h: boolean;
  workingHours: WorkingHours;
  color: string;
  overlapHours: Set<number>;
}) {
  const city = firstCityForTz(zone.tz);
  const effectiveLabel = isHome ? (homeLabel ?? zone.label) : zone.label;
  const display = effectiveLabel ?? city?.name ?? humanizeIana(zone.tz);
  const country = city?.country;
  const abbr = zoneAbbreviation(zone.tz);

  const cells = hours.map((h) => {
    const r = computeDayOffset(homeTz, zone.tz, referenceDate, h);
    return { ...r, homeHour: h };
  });

  return (
    <View style={isLast ? styles.rowLast : styles.row} wrap={false}>
      <View style={styles.labelCol}>
        <View style={styles.labelTitleRow}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text style={styles.labelText}>
            {display}
            {isHome ? " (home)" : ""}
          </Text>
        </View>
        <Text style={styles.labelMeta}>
          {country ? `${country} · ` : ""}
          {abbr}
        </Text>
        <Text style={styles.labelMeta}>
          {pad(workingHours.start)}:00–{pad(workingHours.end)}:00
        </Text>
      </View>

      <View style={styles.cellsRow}>
        {cells.map((cell, i) => {
          const inWorking = isWorkingHour(cell.cell.hour, workingHours);
          const isOverlap = overlapHours.has(cell.homeHour);
          const prev = cells[i - 1];
          const crossesDay = prev && prev.dayOffset !== cell.dayOffset;
          const cellBg = isOverlap ? "#dcfce7" : inWorking ? hexToSoft(color) : "transparent";
          const chip = formatDayChip(cell.dayOffset);

          return (
            <View
              key={i}
              style={[
                styles.cell,
                crossesDay ? styles.cellBoundary : {},
                { backgroundColor: cellBg },
              ]}
            >
              {isOverlap && <View style={styles.overlapStripe} />}
              <Text style={[styles.cellText, inWorking ? styles.cellTextWork : {}]}>
                {formatHour(cell.cell.hour, cell.cell.minute, use24h)}
              </Text>
              {chip && (
                <Text
                  style={[
                    styles.dayChip,
                    cell.dayOffset > 0 ? styles.dayChipAhead : styles.dayChipBehind,
                  ]}
                >
                  {chip}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Validity bar
// ---------------------------------------------------------------------------

function PdfValidityBar({
  homeTz,
  homeLabel,
  zones,
}: {
  homeTz: string;
  homeLabel?: string;
  zones: ZoneConfig[];
}) {
  // Single-zone views don't need a "valid through" warning — there's
  // nothing to line up, DST or not.
  if (zones.length === 0) return null;
  const earliest = earliestTransitionAcross([homeTz, ...zones.map((z) => z.tz)]);
  if (!earliest) return null;
  const { tz, transition } = earliest;
  const zoneName =
    tz === homeTz
      ? resolveZoneName({ tz: homeTz }, homeLabel)
      : resolveZoneName(zones.find((z) => z.tz === tz) ?? { tz });
  const direction = transition.deltaMinutes > 0 ? "springs forward" : "falls back";
  const abbr = transition.abbreviationAfter;

  const oneDay = 24 * 60 * 60 * 1000;
  const lastValidInstant = new Date(transition.after.getTime() - oneDay);
  const homeOffset = zoneOffsetMinutes(lastValidInstant, homeTz);
  const localLastValid = new Date(lastValidInstant.getTime() + homeOffset * 60_000);
  const validThroughStr = localLastValid.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <View style={styles.validityBar} wrap={false}>
      <Text>
        <Text style={styles.validityBold}>Valid through {validThroughStr}.</Text>{" "}
        {zoneName} {direction}
        {abbr ? ` to ${abbr}` : ""} after that — reprint once that date passes.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DST section
// ---------------------------------------------------------------------------

function DstSection({ homeTz, zones }: { homeTz: string; zones: ZoneConfig[] }) {
  const tzs: string[] = [];
  const seen = new Set<string>();
  for (const tz of [homeTz, ...zones.map((z) => z.tz)]) {
    if (seen.has(tz)) continue;
    seen.add(tz);
    tzs.push(tz);
  }

  return (
    <View style={styles.dstSection} wrap={false}>
      <Text style={styles.dstHeading}>Daylight saving time — next transitions</Text>
      {tzs.map((tz) => {
        const city = firstCityForTz(tz);
        const display = city?.name ?? humanizeIana(tz);
        const now = new Date();
        const abbr = zoneAbbreviation(tz, now) || formatOffset(zoneOffsetMinutes(now, tz));
        const t = nextDstTransition(tz);
        return (
          <View key={tz} style={styles.dstRow}>
            <Text style={styles.dstLabel}>
              {display}
              {city?.country ? `, ${city.country}` : ""}  ({abbr})
            </Text>
            <Text style={[styles.dstValue, styles.dstMono]}>
              {t
                ? `${t.deltaMinutes > 0 ? "Spring forward" : "Fall back"} ${t.after.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} → ${t.abbreviationAfter || formatOffset(t.offsetAfter)}`
                : `No DST — fixed at ${formatOffset(zoneOffsetMinutes(now, tz))}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWorkingHour(hour: number, wh: WorkingHours): boolean {
  if (wh.start <= wh.end) return hour >= wh.start && hour < wh.end;
  return hour >= wh.start || hour < wh.end;
}

function formatDayChip(dayOffset: number): string | null {
  if (dayOffset === 0) return null;
  if (dayOffset > 0) return `+${dayOffset}d`;
  return `${dayOffset}d`;
}

function labelForHomeHour(h: number, use24h: boolean): string {
  if (use24h) return h.toString().padStart(2, "0");
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Soft tint of the zone color for working-hour cells. Approximate 15%
 * opacity by blending with white since react-pdf doesn't reliably honor
 * rgba() backgrounds.
 */
function hexToSoft(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c + (255 - c) * 0.7);
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}
