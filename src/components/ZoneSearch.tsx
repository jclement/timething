/**
 * ZoneSearch — typeahead input for picking a time zone. Accepts any of:
 *   - city name    ("Houston")
 *   - country      ("Saudi Arabia")
 *   - IANA name    ("America/Chicago")
 *   - abbreviation ("CST", "PDT")
 *
 * The results dropdown is rendered via a portal into <body> with fixed
 * positioning so it escapes any ancestor `overflow-x-auto` clipping (the
 * dashboard's scrolling hour grid is one such ancestor).
 */

import { Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchZones, type SearchHit } from "../lib/timezones";

interface Props {
  placeholder?: string;
  autoFocus?: boolean;
  onSelect: (hit: SearchHit) => void;
  onCancel?: () => void;
  /** Render as an add-row (adds Plus icon accent). */
  variant?: "add" | "edit";
}

interface Position {
  top: number;
  left: number;
  width: number;
}

export function ZoneSearch({
  placeholder = "Add a city, country, or time zone…",
  autoFocus,
  onSelect,
  onCancel,
  variant = "add",
}: Props) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchZones(query), [query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Keep the portal dropdown glued to the input as the page scrolls/resizes.
  const updatePosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!query) {
      setPosition(null);
      return;
    }
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [query, updatePosition]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[highlight];
      if (hit) {
        onSelect(hit);
        setQuery("");
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else onCancel?.();
    }
  };

  const LeadIcon = variant === "add" ? Plus : Search;

  const dropdown =
    query && position
      ? createPortal(
          <div
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 50,
            }}
          >
            {hits.length > 0 ? (
              <ul
                role="listbox"
                className="bg-surface border border-app rounded-md shadow-lg max-h-72 overflow-y-auto"
              >
                {hits.map((hit, i) => (
                  <li
                    key={hit.id}
                    role="option"
                    aria-selected={i === highlight}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-3 ${
                      i === highlight ? "bg-selected" : "hover:bg-hover"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(hit);
                      setQuery("");
                    }}
                    onMouseEnter={() => setHighlight(i)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-heading truncate">{hit.label}</div>
                      <div className="text-xs text-muted truncate font-mono">{hit.sublabel}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="bg-surface border border-app rounded-md shadow-lg px-3 py-2 text-sm text-muted">
                No matches for <span className="text-body font-medium">{query}</span>.
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex items-center gap-2 px-3 h-11 bg-surface border border-dashed border-app-strong rounded-md focus-within:border-solid focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 transition">
        <LeadIcon className="w-4 h-4 text-muted flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm text-heading placeholder:text-muted"
          aria-label="Search time zones"
          autoComplete="off"
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
      {dropdown}
    </div>
  );
}
