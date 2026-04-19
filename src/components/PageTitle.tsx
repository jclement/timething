/**
 * PageTitle — the title shown in the top bar.
 *
 * If the user hasn't overridden it, the title is the comma-joined list
 * of zone names ("Calgary, Riyadh, Houston"). Clicking the title turns
 * it into an input so the user can type a custom label like
 * "Barreleye work schedule". Clearing the input reverts to the derived
 * default.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  /** User-provided override, or undefined if using the derived default. */
  override: string | undefined;
  /** Derived default ("Calgary, Riyadh, Houston"). */
  derived: string;
  onChange: (next: string | undefined) => void;
}

export function PageTitle({ override, derived, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(override ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const display = override || derived;

  useEffect(() => {
    if (!editing) setDraft(override ?? "");
  }, [override, editing]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    // Empty string → clear override so the derived default takes over.
    onChange(draft.trim() || undefined);
    setEditing(false);
  };

  return editing ? (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
      placeholder={derived}
      className="flex-shrink min-w-0 h-7 px-1.5 text-sm font-medium text-heading bg-transparent border-b border-[var(--color-primary)] outline-none"
      aria-label="Page title"
    />
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      onDoubleClick={() => setEditing(true)}
      title="Click to rename"
      className="min-w-0 max-w-[50vw] truncate text-sm font-medium text-subtle hover:text-body hover:underline decoration-dotted"
    >
      {display}
    </button>
  );
}
