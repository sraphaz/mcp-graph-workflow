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

test.describe("Insights Tab — Redesigned", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Insights" }).click();
    await page.waitForTimeout(1500);
  });

  test("renders health gauge section", async ({ page }) => {
    // Health score number is visible
    await expect(page.getByText("Health Score")).toBeVisible();
  });

  test("renders KPI cards", async ({ page }) => {
    await expect(page.getByText("Total Tasks")).toBeVisible();
    await expect(page.getByText("Completion")).toBeVisible();
    await expect(page.getByText("Velocity")).toBeVisible();
    await expect(page.getByText("Blocked")).toBeVisible();
  });

  test("renders chart sections", async ({ page }) => {
    await expect(page.getByText("Status Distribution")).toBeVisible();
    await expect(page.getByText("Node Types")).toBeVisible();
    await expect(page.getByText("Sprint Progress")).toBeVisible();
    await expect(page.getByText("Knowledge Coverage")).toBeVisible();
  });

  test("renders bottlenecks section", async ({ page }) => {
    await expect(page.getByText("Bottlenecks")).toBeVisible();
  });

  test("has refresh button", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: "Refresh" });
    await expect(refreshBtn).toBeVisible();
  });
});
