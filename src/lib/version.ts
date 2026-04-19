/**
 * Build version — what git says at build time. Shown in the footer and
 * the PDF so you can eyeball which deploy you're looking at.
 */

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
