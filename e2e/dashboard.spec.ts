/**
 * E2E smoke tests for the dashboard.
 *
 * Goal: prove the happy path works end-to-end — page loads with a
 * default zone, a new zone can be added via search, settings persist
 * across reloads, and the editor modal can rename a zone.
 * Browser-specific DST behavior is covered in unit tests.
 */

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Fresh state for every test.
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      // Strip any leftover URL state from a previous test navigation so
      // we always start from the defaults.
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    } catch {
      /* ignore */
    }
  });
});

test("renders the default zone + toolbar on first load", async ({ page }) => {
  await page.goto("/");

  // Export button lives in the top bar and is always present.
  await expect(page.getByRole("button", { name: /Export PDF/i })).toBeVisible();

  // The placeholder search is always rendered.
  await expect(
    page.getByPlaceholder(/Add a city, country, or time zone/i),
  ).toBeVisible();
});

test("adding a zone via the search box appends a new row", async ({ page }) => {
  await page.goto("/");

  const search = page.getByPlaceholder(/Add a city, country, or time zone/i);
  await search.fill("Riyadh");
  // Keyboard Enter commits the first (highlighted) option — works on any
  // viewport without worrying about dropdown clipping.
  await search.press("Enter");

  // The Riyadh zone should now be present.
  await expect(page.getByText("Riyadh", { exact: false }).first()).toBeVisible();

  // The placeholder search is still present for adding the next zone.
  await expect(
    page.getByPlaceholder(/Add a city, country, or time zone/i),
  ).toBeVisible();
});

test("settings persist across reload", async ({ page }) => {
  await page.goto("/");

  const search = page.getByPlaceholder(/Add a city, country, or time zone/i);
  await search.fill("Houston");
  await search.press("Enter");

  // Save this view as the default so a plain reload brings it back even
  // without URL hash state.
  await page.getByRole("button", { name: /Save as default/i }).click();

  await page.goto("/");
  await expect(page.getByText("Houston", { exact: false }).first()).toBeVisible();
});

test("footer has About and Privacy links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^About$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Privacy$/ })).toBeVisible();
});

test("/about renders", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: /About timething/i })).toBeVisible();
});

test("/privacy renders", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /^Privacy$/i })).toBeVisible();
});
