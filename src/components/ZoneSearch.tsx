/**
 * ZoneSearch — typeahead input for picking a time zone.
 *
 * Built on Headless UI's Combobox, which handles everything that's
 * fiddly about a typeahead floating above other content: portal,
 * viewport-aware placement (flip above when there's no room below),
 * keyboard nav, scroll lock, focus management, and ARIA. We just wire
 * up the search + onSelect semantics.
 */

import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { searchZones, type SearchHit } from "../lib/timezones";

interface Props {
  placeholder?: string;
  autoFocus?: boolean;
  onSelect: (hit: SearchHit) => void;
  onCancel?: () => void;
  /** Render as an add-row (`+` icon) or an edit-row (magnifying glass). */
  variant?: "add" | "edit";
}

export function ZoneSearch({
  placeholder = "Add a city, country, or time zone…",
  autoFocus,
  onSelect,
  onCancel,
  variant = "add",
}: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchZones(query), [query]);
  const LeadIcon = variant === "add" ? Plus : Search;

  // We treat the combobox as a pure picker — nothing stays "selected"
  // between picks, so value is always null and onChange just fires the
  // callback + clears the query.
  const handleChange = (hit: SearchHit | null) => {
    if (!hit) return;
    onSelect(hit);
    setQuery("");
  };

  return (
    <Combobox<SearchHit | null>
      value={null}
      onChange={handleChange}
      immediate
    >
      <div className="relative w-full">
        <div className="flex items-center gap-2 px-3 h-11 bg-surface border border-dashed border-app-strong rounded-md focus-within:border-solid focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-focus)]/30 transition">
          <LeadIcon className="w-4 h-4 text-muted flex-shrink-0" />
          <ComboboxInput
            ref={inputRef}
            autoFocus={autoFocus}
            displayValue={() => query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Escape: first keystroke clears the query, second bubbles
              // up to let a caller close an edit-mode search.
              if (e.key === "Escape" && !query && onCancel) {
                e.preventDefault();
                onCancel();
              }
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm text-heading placeholder:text-muted"
            aria-label="Search time zones"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {onCancel && (
            <button
              type="button"
              aria-label="Cancel"
              onClick={onCancel}
              className="text-muted hover:text-body"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* anchor="bottom start" + modal={false} → Headless UI portals the
         * list, flips above when there's no room below, clamps to the
         * visible viewport (respects VisualViewport on mobile), and
         * handles keyboard nav. The `--input-width` CSS var is exposed
         * by Headless UI so the list matches the input width. */}
        <ComboboxOptions
          anchor={{ to: "bottom start", gap: 4 }}
          transition
          className="w-[var(--input-width)] max-h-72 empty:invisible bg-surface border border-app rounded-md shadow-lg overflow-y-auto origin-top data-[closed]:opacity-0 data-[closed]:-translate-y-1 transition duration-100 ease-out z-50"
        >
          {hits.length === 0 && query ? (
            <div className="px-3 py-2 text-sm text-muted">
              No matches for <span className="text-body font-medium">{query}</span>.
            </div>
          ) : (
            hits.map((hit) => (
              <ComboboxOption
                key={hit.id}
                value={hit}
                className="group px-3 py-2 cursor-pointer flex items-center justify-between gap-3 data-[focus]:bg-selected hover:bg-hover"
              >
                <div className="min-w-0">
                  <div className="text-sm text-heading truncate">{hit.label}</div>
                  <div className="text-xs text-muted truncate font-mono">{hit.sublabel}</div>
                </div>
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
