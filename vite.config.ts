/**
 * Vite config — wires React, Tailwind v4, TanStack Router's file-based
 * generator, and the Cloudflare Worker plugin. In dev, the Cloudflare
 * plugin runs a miniflare-backed worker alongside Vite so API calls
 * added later ("I may add logic later") will work without extra setup.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    cloudflare(),
  ],
  build: {
    sourcemap: true,
  },
});
