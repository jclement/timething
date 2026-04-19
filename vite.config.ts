/**
 * Vite config — wires React, Tailwind v4, TanStack Router's file-based
 * generator, the Cloudflare Worker plugin, and the PWA plugin.
 *
 * In dev, the Cloudflare plugin runs a miniflare-backed worker alongside
 * Vite so API calls added later work without extra setup.
 *
 * `__APP_VERSION__` is injected at build time from `git describe` so the
 * footer (and PDF) can show exactly which build is live. Falls back to
 * "dev" when there's no git metadata (shallow CI clones, tarballs, etc).
 *
 * VitePWA generates a service worker that precaches the built assets for
 * offline use, and a manifest so the app can be installed to the home
 * screen on iOS/Android/desktop. `autoUpdate` means new deploys roll out
 * silently on the next page load — fine here because all state lives in
 * localStorage / URL, so a refresh never costs anything.
 */
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

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
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "apple-touch-icon-180x180.png",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // The Cloudflare Worker serves /api/* — never cache API calls.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: "timething",
        short_name: "timething",
        description:
          "A clean time-zone comparison dashboard for finding meeting times.",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
    cloudflare(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion()),
  },
  build: {
    sourcemap: true,
  },
});
