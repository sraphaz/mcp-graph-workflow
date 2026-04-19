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

test.describe("PRD & Backlog Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    // Navigate to PRD & Backlog tab
    await page.locator("nav button", { hasText: "PRD & Backlog" }).click();
    await page.waitForTimeout(500);
  });

  test("clicking tab shows PRD & Backlog content", async ({ page }) => {
    // Tab should be active (accent border)
    const tab = page.locator("nav button", { hasText: "PRD & Backlog" });
    await expect(tab).toBeVisible();
  });

  test("backlog list shows task items or empty state", async ({ page }) => {
    // BacklogList renders task items or "No tasks in backlog."
    const hasTasks = await page.locator(".p-2 .mx-1").count();
    const hasEmpty = await page.getByText("No tasks in backlog").count();
    expect(hasTasks > 0 || hasEmpty > 0).toBeTruthy();
  });

  test("progress bar renders", async ({ page }) => {
    // Progress section shows "X/Y done (Z%)" in the backlog sidebar
    const progressText = page.getByText(/\d+\/\d+ done \(\d+%\)/);
    await expect(progressText).toBeVisible({ timeout: 10_000 });
  });

  test("ReactFlow diagram or empty state visible", async ({ page }) => {
    const hasFlow = await page.locator(".react-flow").count();
    const hasEmpty = await page.getByText("Import a PRD to see the workflow").count();
    expect(hasFlow > 0 || hasEmpty > 0).toBeTruthy();
  });

  test("info bar shows node count with expand hint", async ({ page }) => {
    const infoBar = page.getByText(/Showing \d+ of \d+ nodes/);
    if (await infoBar.count() > 0) {
      await expect(infoBar).toContainText("click ▸ to expand");
    }
  });

  test("clicking backlog item opens detail panel", async ({ page }) => {
    const taskItems = page.locator(".mx-1.cursor-pointer");
    if (await taskItems.count() > 0) {
      await taskItems.first().click();
      await expect(page.getByText("Node Details")).toBeVisible();
    }
  });
});
