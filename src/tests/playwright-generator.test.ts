/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — Generator recipe → spec.ts
 *
 * AC1: GIVEN recipe login flow WHEN generator THEN spec has correct Playwright structure
 * AC2: GIVEN spec gerado WHEN inspecionado THEN não importa src/, mcp-graph/, vendor/
 * AC4: GIVEN cada test WHEN inspecionado THEN começa com // @generated-from header
 */

import { describe, it, expect } from "vitest";
import { generatePlaywrightSpec } from "../core/browser-harness/playwright-generator.js";
import type { Recipe } from "../schemas/recipe.schema.js";

const LOGIN_RECIPE: Recipe = {
  runId: "run-login-001",
  createdAt: 1700000000000,
  steps: [
    {
      kind: "navigate",
      payload: "https://example.com/login",
      evidence_before: "before-1.png",
      evidence_after: "after-1.png",
    },
    {
      kind: "type",
      selector: "#email",
      payload: "user@example.com",
      evidence_before: "before-2.png",
      evidence_after: "after-2.png",
    },
    {
      kind: "click",
      selector: "#submit",
      evidence_before: "before-3.png",
      evidence_after: "after-3.png",
      assert_after: { type: "visible", selector: "#dashboard" },
    },
  ],
};

// ---------------------------------------------------------------------------
// AC1: valid Playwright spec structure
// ---------------------------------------------------------------------------

describe("generatePlaywrightSpec — AC1: Playwright structure", () => {
  it("contains import from @playwright/test", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).toContain("import { test, expect } from '@playwright/test'");
  });

  it("wraps steps in a test() block", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).toMatch(/test\s*\(/);
  });

  it("navigate step becomes page.goto()", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).toContain("await page.goto('https://example.com/login')");
  });

  it("type step becomes page.fill(selector, payload)", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).toContain("await page.fill('#email', 'user@example.com')");
  });

  it("click step becomes page.click(selector)", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).toContain("await page.click('#submit')");
  });

  it("assert_after visible becomes expect(page.locator()).toBeVisible()", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).toContain("#dashboard");
    expect(spec).toContain("toBeVisible");
  });

  it("screenshots become toHaveScreenshot with runId-step-N.png", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).toContain("run-login-001-step-1.png");
  });
});

// ---------------------------------------------------------------------------
// AC2: no bad imports
// ---------------------------------------------------------------------------

describe("generatePlaywrightSpec — AC2: zero mcp-graph imports", () => {
  it("does not import from src/", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).not.toMatch(/from ['"].*src\//);
  });

  it("does not import from mcp-graph", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).not.toContain("mcp-graph");
  });

  it("does not import from vendor/", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).not.toMatch(/from ['"].*vendor\//);
  });
});

// ---------------------------------------------------------------------------
// AC4: @generated-from header
// ---------------------------------------------------------------------------

describe("generatePlaywrightSpec — AC4: @generated-from header", () => {
  it("contains // @generated-from header with runId", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    expect(spec).toMatch(/\/\/ @generated-from runId=run-login-001/);
  });

  it("header appears near the top of the file (within first 5 lines)", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    const lines = spec.split("\n").slice(0, 5);
    const hasHeader = lines.some((l) => l.includes("@generated-from"));
    expect(hasHeader).toBe(true);
  });

  it("header includes a date", () => {
    const spec = generatePlaywrightSpec(LOGIN_RECIPE);
    // Date should appear as YYYY-MM-DD
    expect(spec).toMatch(/@generated-from.*on \d{4}-\d{2}-\d{2}/);
  });
});
