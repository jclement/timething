/**
 * SiteFooter — brand, rotating tagline, privacy link.
 * Hidden in print.
 */

import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Brand } from "./Brand";
import { randomTagline } from "../lib/taglines";
import { APP_VERSION } from "../lib/version";

export function SiteFooter() {
  const tagline = useMemo(() => randomTagline(), []);
  return (
    <footer className="no-print border-t border-app mt-4">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted">
        <div className="flex items-center gap-2">
          <Brand className="font-semibold text-subtle" />
          <span aria-hidden="true">·</span>
          <span className="italic">{tagline}</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[11px] text-muted/80"
            title="Deployed build (git describe)"
          >
            {APP_VERSION}
          </span>
          <Link to="/about" className="hover:text-body hover:underline">
            About
          </Link>
          <Link to="/privacy" className="hover:text-body hover:underline">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
