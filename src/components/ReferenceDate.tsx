/**
 * ReferenceDate — small native date input. Exists because DST makes
 * "what hours line up with mine" depend on the calendar date. Defaults
 * to today in the user's home zone.
 */

import { CalendarDays } from "lucide-react";

interface Props {
  value: string;
  onChange: (iso: string) => void;
  onResetToToday?: () => void;
}

export function ReferenceDate({ value, onChange, onResetToToday }: Props) {
  return (
    <div className="flex items-center gap-1.5 bg-surface border border-app rounded-md px-2 h-9 text-xs">
      <CalendarDays className="w-3.5 h-3.5 text-muted flex-shrink-0" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none text-heading font-mono tabular-nums min-w-0 w-[7.5rem]"
        aria-label="Reference date"
      />
      {onResetToToday && (
        <button
          type="button"
          onClick={onResetToToday}
          className="text-[var(--color-primary)] hover:underline font-medium"
        >
          Today
        </button>
      )}
    </div>
  );
}
