/**
 * E2E smoke tests for the dashboard.
 *
 * Goal: prove the happy path works end-to-end — page loads, the home
 * zone renders, a new zone can be added via search, settings persist
 * across reloads. Browser-specific DST behavior is covered in unit tests.
 */

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test("home zone row renders on first load", async ({ page }) => {
  await page.goto("/");
  // The label column has the Home icon; the row is always the first zone row.
  await expect(page.locator("text=Home hour").first()).toBeVisible();
  // An "Export PDF" button should exist even with no zones added yet.
  await expect(page.getByRole("button", { name: /Export PDF/ })).toBeVisible();
});

test("adding a zone via the search box appends a new row", async ({ page }) => {
  await page.goto("/");

  const search = page.getByPlaceholder(/Add a city, country, or time zone/);
  await search.fill("Riyadh");
  await page.getByRole("option").first().click();

  // The Riyadh row should now exist.
  await expect(page.getByText("Riyadh", { exact: false }).first()).toBeVisible();

  // The placeholder search is still present for adding the next zone.
  await expect(page.getByPlaceholder(/Add a city, country, or time zone/)).toBeVisible();
});

test("settings persist across reload", async ({ page }) => {
  await page.goto("/");

  const search = page.getByPlaceholder(/Add a city, country, or time zone/);
  await search.fill("Houston");
  await page.getByRole("option").first().click();

  await page.reload();
  await expect(page.getByText("Houston", { exact: false }).first()).toBeVisible();
});
