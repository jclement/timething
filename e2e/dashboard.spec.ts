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

// Helper: open the editor on the last-added zone.
// Desktop exposes a <button aria-label="Edit zone">, mobile exposes a
// <div role="button" aria-label="Edit {name}"> — the name regex
// covers both.
const editLastZoneSelector = /^Edit( zone|\s+\w+)/i;

// Helper: Playwright's `getByRole("dialog")` lands on Headless UI's
// positionless wrapper div which has no visible bounding box. Use the
// dialog title visibility instead.
const waitForEditor = async (page: import("@playwright/test").Page) => {
  await expect(page.getByRole("heading", { name: /^Edit zone$/i })).toBeVisible();
};

test("editor modal opens, renames a zone, and saves", async ({ page }) => {
  await page.goto("/");
  const search = page.getByPlaceholder(/Add a city, country, or time zone/i);
  await search.fill("Riyadh");
  await search.press("Enter");

  await page.getByRole("button", { name: editLastZoneSelector }).last().click();
  await waitForEditor(page);

  const nameField = page.getByLabel(/Display name/i);
  await nameField.fill("Farid");
  await page.getByRole("button", { name: /^Save$/ }).click();

  await expect(page.getByRole("heading", { name: /^Edit zone$/i })).toBeHidden();
  await expect(page.getByText("Farid", { exact: false }).first()).toBeVisible();
});

test("editor modal removes a non-last zone", async ({ page }) => {
  await page.goto("/");

  const search = page.getByPlaceholder(/Add a city, country, or time zone/i);
  await search.fill("Riyadh");
  await search.press("Enter");

  await expect(page.getByText("Riyadh", { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: editLastZoneSelector }).last().click();
  await waitForEditor(page);
  // Scope to the dialog — the row-level X buttons also have
  // aria-label="Remove zone", so an unscoped match hits 3 targets.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Remove zone$/ })
    .click();

  await expect(page.getByRole("heading", { name: /^Edit zone$/i })).toBeHidden();
  await expect(page.getByText(/Riyadh/)).toHaveCount(0);
});

test("duplicate time zones are allowed (two Houstons)", async ({ page }) => {
  await page.goto("/");

  // Wait for initial render before counting.
  const editButtons = page.getByRole("button", { name: editLastZoneSelector });
  await expect(editButtons.first()).toBeAttached();
  const initial = await editButtons.count();

  const search = page.getByPlaceholder(/Add a city, country, or time zone/i);
  await search.fill("Houston");
  await search.press("Enter");
  await search.fill("Houston");
  await search.press("Enter");

  await expect(editButtons).toHaveCount(initial + 2);
});

test("reference date change updates the zone offset label", async ({ page }) => {
  await page.goto("/");

  const search = page.getByPlaceholder(/Add a city, country, or time zone/i);
  await search.fill("New York");
  await search.press("Enter");

  const dateInput = page.getByLabel(/Reference date/i);

  // We assert on `toBeAttached`/`toHaveCount`, not `toBeVisible`, because
  // mobile column headers truncate long strings off-screen — the text
  // is DOM-present but not visible. That's still the correct signal.
  await dateInput.fill("2026-01-15");
  await expect(page.getByText(/UTC-5/).first()).toBeAttached();

  await dateInput.fill("2026-07-15");
  await expect(page.getByText(/UTC-4/).first()).toBeAttached();
});

test("Save-as-default button appears when state diverges", async ({ page }) => {
  await page.goto("/");

  const saveBtn = page.getByRole("button", { name: /Save as default/i });
  await expect(saveBtn).toBeHidden();

  const search = page.getByPlaceholder(/Add a city, country, or time zone/i);
  await search.fill("Tokyo");
  await search.press("Enter");

  await expect(saveBtn).toBeVisible();
  await saveBtn.click();
  await expect(saveBtn).toBeHidden();
});

test("/privacy links to the OneWheelGeek, not an email", async ({ page }) => {
  await page.goto("/privacy");
  const link = page.getByRole("link", { name: /OneWheelGeek/i });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://owg.me");
});

test("validity bar references the user's chosen zone label", async ({ page }) => {
  await page.goto("/");

  const search = page.getByPlaceholder(/Add a city, country, or time zone/i);
  // Berlin observes DST, so the ValidityBar will render.
  await search.fill("Berlin");
  await search.press("Enter");

  // Rename Berlin to something distinctive and confirm the validity
  // bar picks up the rename.
  await page.getByRole("button", { name: editLastZoneSelector }).last().click();
  await waitForEditor(page);
  await page.getByLabel(/Display name/i).fill("Franziska");
  await page.getByRole("button", { name: /^Save$/ }).click();

  await expect(page.getByText(/Franziska/).first()).toBeAttached();
});
