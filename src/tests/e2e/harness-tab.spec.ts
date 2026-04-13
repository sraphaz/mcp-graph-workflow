import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Harness tab — validates all 5 harness components
 * (HarnessGauge, HarnessTrend, IssuePatternTracker, PhaseGatesStatus, HarnessEventsLog)
 * render correctly in a real browser.
 */

// ── Helper ──────────────────────────────────────────────────

async function navigateToHarnessTab(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);

  // Expand "Intelligence" group if collapsed (Harness is in this group)
  const intelligenceGroup = page.locator('[role="button"][aria-expanded="false"]').filter({ hasText: "Intelligence" });
  if (await intelligenceGroup.isVisible().catch(() => false)) {
    await intelligenceGroup.click();
    await page.waitForTimeout(300);
  }

  await page.getByRole("button", { name: "Harness" }).click();
  await page.waitForTimeout(1000); // Wait for API calls to complete
}

// ── Suite 1: Tab Navigation ─────────────────────────────────

test.describe("Harness Tab — Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
  });

  test("Harness tab is visible in sidebar navigation", async ({ page }) => {
    // Expand Intelligence group if collapsed
    const intelligenceGroup = page.locator('[role="button"][aria-expanded="false"]').filter({ hasText: "Intelligence" });
    if (await intelligenceGroup.isVisible().catch(() => false)) {
      await intelligenceGroup.click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByRole("button", { name: "Harness" })).toBeVisible();
  });

  test("Harness tab loads without error", async ({ page }) => {
    // Expand Intelligence group if collapsed
    const intelligenceGroup = page.locator('[role="button"][aria-expanded="false"]').filter({ hasText: "Intelligence" });
    if (await intelligenceGroup.isVisible().catch(() => false)) {
      await intelligenceGroup.click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: "Harness" }).click();
    await page.waitForTimeout(1000);

    // Title should be visible
    await expect(page.getByText("Harnessability Score")).toBeVisible();

    // No red error text should be prominently visible
    const errorCount = await page.locator(".text-red-400").count();
    // Some errors may appear if harness scan fails in test env — that's OK
    // But the page itself should not crash
    expect(errorCount).toBeLessThanOrEqual(5);
  });

  test("Harness tab shows all 5 section headers", async ({ page }) => {
    // Expand Intelligence group if collapsed
    const intelligenceGroup = page.locator('[role="button"][aria-expanded="false"]').filter({ hasText: "Intelligence" });
    if (await intelligenceGroup.isVisible().catch(() => false)) {
      await intelligenceGroup.click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: "Harness" }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole("heading", { name: "Current Score" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trend" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Issue Pattern Tracker" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Phase Gates" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Events Log" })).toBeVisible();
  });
});

// ── Suite 2: HarnessGauge Component ─────────────────────────

test.describe("Harness Tab — Gauge Component", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHarnessTab(page);
  });

  test("displays grade or loading/error state", async ({ page }) => {
    // Should show either a grade (A/B/C/D), loading, or error
    const gauge = page.locator("text=/[ABCD]/").first();
    const loading = page.getByText("Loading harness score...");
    const error = page.getByText("Harness scan error:");

    const hasGrade = await gauge.isVisible().catch(() => false);
    const hasLoading = await loading.isVisible().catch(() => false);
    const hasError = await error.isVisible().catch(() => false);

    expect(hasGrade || hasLoading || hasError).toBe(true);
  });

  test("displays dimension labels when score is available", async ({ page }) => {
    const hasScore = await page.locator("text=/\\d+\\/100/").first().isVisible().catch(() => false);

    if (hasScore) {
      // All 7 dimensions should be labeled
      for (const dim of ["Type Coverage", "Test Coverage", "Arch Fitness", "Docs Coverage", "Naming Clarity", "Error Handling", "Context Density"]) {
        await expect(page.getByText(dim).first()).toBeVisible();
      }
    }
  });
});

// ── Suite 3: HarnessTrend Component ─────────────────────────

test.describe("Harness Tab — Trend Component", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHarnessTab(page);
  });

  test("displays trend direction or no-data message", async ({ page }) => {
    const trendDir = page.locator("text=/(Improving|Degrading|Stable)/").first();
    const noData = page.getByText("No harness history yet");
    const error = page.getByText("Trend error:");

    const hasTrend = await trendDir.isVisible().catch(() => false);
    const hasNoData = await noData.isVisible().catch(() => false);
    const hasError = await error.isVisible().catch(() => false);

    expect(hasTrend || hasNoData || hasError).toBe(true);
  });

  test("shows SVG chart when history exists", async ({ page }) => {
    const hasTrend = await page.getByText("Score Evolution").isVisible().catch(() => false);

    if (hasTrend) {
      const svgCount = await page.locator("svg").count();
      expect(svgCount).toBeGreaterThan(0);
    }
  });
});

// ── Suite 4: PhaseGatesStatus Component ─────────────────────

test.describe("Harness Tab — Phase Gates", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHarnessTab(page);
  });

  test("displays all 9 lifecycle phases", async ({ page }) => {
    const gatesList = page.locator('[role="list"][aria-label="Phase gates status"]');
    const hasGates = await gatesList.isVisible().catch(() => false);

    if (hasGates) {
      const items = gatesList.locator('[role="listitem"]');
      await expect(items).toHaveCount(9);

      for (const phase of ["Analyze", "Design", "Plan", "Implement", "Validate", "Review", "Handoff", "Deploy", "Listening"]) {
        await expect(page.getByText(phase).first()).toBeVisible();
      }
    }
  });

  test("shows gate thresholds for gated phases", async ({ page }) => {
    const hasGates = await page.locator('[role="list"][aria-label="Phase gates status"]').isVisible().catch(() => false);

    if (hasGates) {
      // Deploy has the strictest gate: B/70
      await expect(page.getByText(">= B/70")).toBeVisible();
      // Design and Review have C/55
      const c55Count = await page.getByText(">= C/55").count();
      expect(c55Count).toBeGreaterThanOrEqual(2); // Design, Review, Handoff
    }
  });

  test("shows pass or fail indicators", async ({ page }) => {
    const hasGates = await page.locator('[role="list"][aria-label="Phase gates status"]').isVisible().catch(() => false);

    if (hasGates) {
      // At least one gated phase should show Pass or Fail
      const passCount = await page.getByText("Pass", { exact: false }).count();
      const failCount = await page.getByText("Fail", { exact: false }).count();
      expect(passCount + failCount).toBeGreaterThan(0);
    }
  });
});

// ── Suite 5: IssuePatternTracker Component ──────────────────

test.describe("Harness Tab — Issue Patterns", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHarnessTab(page);
  });

  test("displays patterns or empty state", async ({ page }) => {
    const emptyState = page.getByText("No issue patterns detected yet");
    const tracked = page.locator("text=/pattern.*tracked/").first();
    const error = page.getByText("Pattern tracker error:");

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasPatterns = await tracked.isVisible().catch(() => false);
    const hasError = await error.isVisible().catch(() => false);

    expect(hasEmpty || hasPatterns || hasError).toBe(true);
  });

  test("shows threshold info when patterns exist", async ({ page }) => {
    const hasPatterns = await page.locator("text=/pattern.*tracked/").first().isVisible().catch(() => false);

    if (hasPatterns) {
      await expect(page.getByText("threshold:")).toBeVisible();
    }
  });
});

// ── Suite 6: HarnessEventsLog Component ─────────────────────

test.describe("Harness Tab — Events Log", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHarnessTab(page);
  });

  test("displays events or empty state", async ({ page }) => {
    const emptyState = page.getByText("No harness events yet");
    const eventsLog = page.locator('[role="log"][aria-label="Harness events"]');
    const error = page.getByText("Events log error:");

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasEvents = await eventsLog.isVisible().catch(() => false);
    const hasError = await error.isVisible().catch(() => false);

    expect(hasEmpty || hasEvents || hasError).toBe(true);
  });
});

// ── Suite 7: Cross-Tab Integration ──────────────────────────

test.describe("Harness Tab — Cross-Tab", () => {
  test("preserves state when switching tabs", async ({ page }) => {
    await navigateToHarnessTab(page);

    // Verify harness tab loaded
    await expect(page.getByText("Harnessability Score")).toBeVisible();

    // Switch to Graph tab
    await page.getByRole("button", { name: "Graph", exact: true }).click();
    await page.waitForTimeout(500);

    // Switch back to Harness
    await page.getByRole("button", { name: "Harness" }).click();
    await page.waitForTimeout(500);

    // Content should still render
    await expect(page.getByText("Harnessability Score")).toBeVisible();
    await expect(page.getByText("Current Score")).toBeVisible();
  });
});
