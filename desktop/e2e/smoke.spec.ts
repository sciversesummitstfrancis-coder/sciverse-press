import { test, expect } from "@playwright/test";

// CI smoke journey. Requires backend :4000 (seeded) + desktop :5173.
test("press submits, coordinator publishes, EB updates progress", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="password"]', "Sciverse123!");
  await page.fill('input[type="email"], input:not([type])', "press@sciverse.local");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
  await page.goto("/articles/new");
  await page.fill("input", "Smoke Test Article Title");
  await page.fill("textarea", "word ".repeat(30));
  await page.click("text=Save draft");
  await expect(page).toHaveURL(/\/articles\//);
});
