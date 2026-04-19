/**
 * Vite config — wires React, Tailwind v4, TanStack Router's file-based
 * generator, and the Cloudflare Worker plugin. In dev, the Cloudflare
 * plugin runs a miniflare-backed worker alongside Vite so API calls
 * added later ("I may add logic later") will work without extra setup.
 *
 * `__APP_VERSION__` is injected at build time from `git describe` so the
 * footer (and PDF) can show exactly which build is live. Falls back to
 * "dev" when there's no git metadata (shallow CI clones, tarballs, etc).
 */
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

function gitVersion(): string {
  try {
    return execSync("git describe --always --dirty --tags --abbrev=7", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    cloudflare(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion()),
  },
  build: {
    sourcemap: true,
  },
});
