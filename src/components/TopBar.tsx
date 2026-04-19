/**
 * TopBar — single-row app header.
 *
 * Left: brand + tagline. Right: whatever the page wants to put there
 * (the Dashboard puts its controls here so we don't pay for a second
 * toolbar row). Theme toggle always sits at the very right.
 *
 * Sticky so the toolbar stays reachable while scrolling long grids.
 */

import { Clock, Link as LinkIcon, Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTheme } from "../hooks/useTheme";

interface Props {
  /** Right-side controls specific to the page (toolbar). */
  children?: ReactNode;
  /** When true, render a "back to app" link instead of controls. Used on /privacy. */
  variant?: "app" | "subpage";
}

export function TopBar({ children, variant = "app" }: Props) {
  const { theme, cycle } = useTheme();
  const ThemeIcon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;

  return (
    <header className="no-print sticky top-0 z-30 bg-surface border-b border-app">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-2 flex items-center gap-2 sm:gap-3 flex-wrap">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-heading hover:text-[var(--color-primary)] transition"
          aria-label="timething home"
        >
          <Clock className="w-4 h-4 text-[var(--color-primary)]" />
          <span className="font-semibold tracking-tight text-sm">timething</span>
        </Link>

        {variant === "subpage" && (
          <Link
            to="/"
            className="text-xs text-subtle hover:text-body hover:underline"
          >
            <LinkIcon className="inline w-3 h-3 mr-0.5" />
            Back to app
          </Link>
        )}

        <div className="flex-1" />

        {children && <>{children}</>}

        <button
          type="button"
          aria-label={`Theme: ${theme}`}
          onClick={cycle}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-hover text-subtle"
        >
          <ThemeIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
