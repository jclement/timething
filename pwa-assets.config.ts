/**
 * PWA icon generation. Run with: `npx pwa-assets-generator`.
 *
 * Sources `public/pwa-icon.svg` — a full-bleed square, no rounded
 * corners. iOS and Android apply their own masks on top; if we ship a
 * PNG with transparent rounded corners, iOS fills those corners with
 * white and you get an ugly halo.
 *
 * Override: the built-in `minimal2023Preset` uses sharp's default
 * background color (white) when flattening. For apple-touch-icon and
 * maskable purposes we force blue (#2563eb) so any resize-induced
 * padding still reads as part of the brand instead of leaving a
 * light ring.
 *
 * The regular `favicon.svg` (with rounded corners) is kept separately
 * for the browser-tab favicon, where rounding reads better.
 */
import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

const BRAND_BLUE = "#2563eb";

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset: {
    transparent: {
      ...minimal2023Preset.transparent,
    },
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: BRAND_BLUE, fit: "contain" },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: BRAND_BLUE, fit: "contain" },
    },
  },
  images: ["public/pwa-icon.svg"],
});
