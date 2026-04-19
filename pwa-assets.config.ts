/**
 * PWA icon generation. Run with: `npx pwa-assets-generator`.
 *
 * Sources the master favicon.svg and emits the PNG sizes the manifest
 * references (192, 512, plus a padded 512 for "maskable" safe areas).
 */
import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset: minimal2023Preset,
  images: ["public/favicon.svg"],
});
