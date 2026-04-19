/**
 * Brand — the styled "time[thing]" wordmark.
 *
 * "time" is rendered in the inherited weight + color; "thing" drops to
 * a lighter weight and muted color so the second half reads as a soft
 * modifier rather than a shouted word. Centralized here so TopBar,
 * SiteFooter, About, and any future surface stay in sync.
 */

import type { ReactNode } from "react";

interface Props {
  /** Wrap the whole mark in an element (e.g., `h1`). Defaults to span. */
  as?: "span" | "h1" | "h2";
  /** Extra classes applied to the outer element (sizing, color, etc). */
  className?: string;
  /** Optional prefix, e.g. "About ". Renders in the same style as "time". */
  prefix?: ReactNode;
}

export function Brand({ as: Tag = "span", className = "", prefix }: Props) {
  return (
    <Tag className={`tracking-tight ${className}`}>
      {prefix}
      <span>time</span>
      <span className="font-light text-muted">thing</span>
    </Tag>
  );
}
