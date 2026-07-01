// E2E tests for Kodara Web Application
import { test, expect } from "@playwright/test";

test.describe("Kodara Web - Landlord Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display landlord dashboard with stats", async ({ page }) => {
    await expect(page.getByText("Occupancy", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Collected this month", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Outstanding", { exact: true })).toBeVisible();
  });

  test("should show property list", async ({ page }) => {
    await expect(
      page.getByText("Kahawa West Apartments", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("Kodara Web - Tenant Portal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?role=tenant");
  });

  test("should display tenant balance", async ({ page }) => {
    await expect(
      page.getByText("Current balance", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".balance-card")).toContainText("Ksh 28,500");
  });

  test("should open payment modal", async ({ page }) => {
    await page.getByRole("button", { name: "Pay with M-Pesa" }).click();
    await expect(
      page.getByRole("heading", { name: "Confirm payment" }),
    ).toBeVisible();
  });
});

test.describe("Maintenance Request Flow", () => {
  test("tenant can submit maintenance request", async ({ page }) => {
    await page.goto("/?role=tenant");
    await page.getByRole("button", { name: "Repairs", exact: true }).click();
    await page.getByRole("button", { name: "New request" }).click();
    await page
      .getByPlaceholder("Describe the issue and where it is…")
      .fill("Test issue from E2E");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByText("Test issue from E2E")).toBeVisible();
  });
});
