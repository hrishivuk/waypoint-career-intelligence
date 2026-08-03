import { expect, test } from "@playwright/test";

test("public landing explains the product and BYOK model", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("evidence, not guesswork");
  await expect(page.getByText("Bring your own supported AI provider key")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});

test("public account and legal routes are reachable", async ({ page }) => {
  for (const route of ["/login", "/signup", "/privacy", "/terms"]) {
    const response = await page.goto(route);
    expect(response?.ok(), `${route} should load`).toBeTruthy();
    await expect(page.locator("body")).not.toBeEmpty();
  }
});

test("health endpoint exposes status but no secret values", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(JSON.stringify(body)).not.toMatch(/service_role|encryption_keys|api_key/i);
});
