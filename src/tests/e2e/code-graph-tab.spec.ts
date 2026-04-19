/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { test, expect } from "@playwright/test";

/**
 * Validates tab structure after migration:
 *   - "Code Graph" tab exists (native code intelligence, replaced GitNexus)
 *   - "Memories" tab exists (native memories, replaced Serena)
 *   - Navigation has 7 tabs total
 */
test.describe("Code Graph Tab — Post-Migration Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should show 'Code Graph' tab in navigation", async ({ page }) => {
    const codeGraphTab = page.locator("nav button", { hasText: "Code Graph" });
    await expect(codeGraphTab).toBeVisible();
  });

  test("should show 'Memories' tab in navigation", async ({ page }) => {
    const memoriesTab = page.locator("nav button", { hasText: "Memories" });
    await expect(memoriesTab).toBeVisible();
  });

  test("navigation should have 7 tabs total", async ({ page }) => {
    const tabs = page.locator("nav button");
    await expect(tabs).toHaveCount(7);
  });
});
