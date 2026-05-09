/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — recipe → spec.ts generator (Task 1.2)
 *
 * Emits standalone TypeScript Playwright test specs from a Recipe.
 * Zero mcp-graph dependency in generated output — spec runs anywhere
 * with `npx playwright test` and no knowledge of this project.
 */

import type { Recipe, RecipeStep } from "../../schemas/recipe.schema.js";

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function generateAssertion(step: RecipeStep, stepIndex: number, runId: string): string[] {
  const lines: string[] = [];

  if (step.assert_after) {
    const a = step.assert_after;
    if (a.type === "visible" && a.selector) {
      lines.push(`await expect(page.locator('${a.selector}')).toBeVisible();`);
    } else if (a.type === "hidden" && a.selector) {
      lines.push(`await expect(page.locator('${a.selector}')).toBeHidden();`);
    } else if (a.type === "text" && a.selector && a.value) {
      lines.push(`await expect(page.locator('${a.selector}')).toHaveText('${a.value}');`);
    } else if (a.type === "url" && a.value) {
      lines.push(`await expect(page).toHaveURL('${a.value}');`);
    } else if (a.type === "count" && a.selector && a.value) {
      lines.push(`await expect(page.locator('${a.selector}')).toHaveCount(${a.value});`);
    }
  }

  lines.push(`await expect(page).toHaveScreenshot('${runId}-step-${stepIndex}.png');`);
  return lines;
}

function generateStep(step: RecipeStep, index: number, runId: string): string[] {
  const lines: string[] = [];
  const n = index + 1;

  switch (step.kind) {
    case "navigate":
      lines.push(`await page.goto('${step.payload ?? ""}');`);
      break;
    case "click":
      if (step.selector) {
        lines.push(`await page.click('${step.selector}');`);
      } else if (step.coords) {
        lines.push(`await page.mouse.click(${step.coords.x}, ${step.coords.y});`);
      }
      break;
    case "type":
      if (step.selector) {
        lines.push(`await page.fill('${step.selector}', '${step.payload ?? ""}');`);
      }
      break;
    case "scroll":
      if (step.selector) {
        lines.push(`await page.locator('${step.selector}').scrollIntoViewIfNeeded();`);
      } else if (step.coords) {
        lines.push(`await page.mouse.wheel(${step.coords.x}, ${step.coords.y});`);
      }
      break;
    case "wait":
      lines.push(step.selector
        ? `await page.waitForSelector('${step.selector}');`
        : `await page.waitForTimeout(${step.payload ?? 1000});`);
      break;
    case "assert":
      // assert_after handled below
      break;
    case "screenshot":
      // screenshot taken via toHaveScreenshot below
      break;
  }

  lines.push(...generateAssertion(step, n, runId));
  return lines;
}

/**
 * Generate a standalone Playwright test spec from a recipe.
 * The output is a complete .ts file with zero mcp-graph dependencies.
 */
export function generatePlaywrightSpec(recipe: Recipe, featureId?: string): string {
  const { runId, createdAt, steps } = recipe;
  const date = isoDate(createdAt);
  const feature = featureId ?? runId;

  const headerComment = `// @generated-from runId=${runId} on ${date} for feature=${feature}`;
  const importLine = `import { test, expect } from '@playwright/test';`;

  const stepLines = steps.flatMap((step, i) => generateStep(step, i, runId));
  const stepBlock = stepLines.map((l) => "  " + l).join("\n");

  const testBlock = [
    `test('generated from ${runId}', async ({ page }) => {`,
    stepBlock,
    `});`,
  ].join("\n");

  return [headerComment, "", importLine, "", testBlock, ""].join("\n");
}
