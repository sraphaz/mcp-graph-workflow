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

test.describe("Siebel Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Navigate to Siebel tab
    const siebelTab = page.locator("nav button", { hasText: "Siebel" });
    await siebelTab.click();
    await page.waitForTimeout(1500);
  });

  // ── Tab presence & badge ─────────────────────────

  test("should display Siebel tab in navigation with Beta badge", async ({ page }) => {
    const tab = page.locator("nav button", { hasText: "Siebel" });
    await expect(tab).toBeVisible();
    // Beta badge should be present inside the tab button
    await expect(tab.locator("text=Beta")).toBeVisible();
  });

  // ── Panel 1: Upload & Context ────────────────────

  test("should show Upload & Context panel", async ({ page }) => {
    await expect(page.locator("h3", { hasText: "Upload & Context" })).toBeVisible();
    await expect(page.getByText("Upload SIF files and documentation")).toBeVisible();
  });

  test("should show SIF file upload input", async ({ page }) => {
    await expect(page.getByText("SIF File (.sif)")).toBeVisible();
    const sifInput = page.locator('input[type="file"][accept=".sif,.xml"]');
    await expect(sifInput).toBeAttached();
  });

  test("should show documentation upload input", async ({ page }) => {
    await expect(page.getByText(/Documentation/)).toBeVisible();
    const docsInput = page.locator('input[type="file"][accept*=".pdf"]');
    await expect(docsInput).toBeAttached();
  });

  // ── Panel 2: Indexed Siebel Objects ──────────────

  test("should show Indexed Siebel Objects panel", async ({ page }) => {
    await expect(page.locator("h3", { hasText: "Indexed Siebel Objects" })).toBeVisible();
  });

  test("should show empty state when no objects imported", async ({ page }) => {
    await expect(page.getByText("No Siebel objects indexed yet")).toBeVisible();
    await expect(page.getByText("0 objects")).toBeVisible();
  });

  // ── Panel 3: SIF Generation ──────────────────────

  test("should show SIF Generation panel", async ({ page }) => {
    await expect(page.locator("h3", { hasText: "SIF Generation" })).toBeVisible();
    await expect(page.getByText("Describe what you need")).toBeVisible();
  });

  test("should show description textarea", async ({ page }) => {
    const textarea = page.getByPlaceholder(/Business Component/);
    await expect(textarea).toBeVisible();
  });

  test("should show Generate button disabled when description empty", async ({ page }) => {
    const btn = page.getByRole("button", { name: "Generate Context & Prompt" });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test("should enable Generate button when description has text", async ({ page }) => {
    const textarea = page.getByPlaceholder(/Business Component/);
    await textarea.fill("Create a BC for Service Requests");

    const btn = page.getByRole("button", { name: "Generate Context & Prompt" });
    await expect(btn).toBeEnabled();
  });

  test("should show Base Project input", async ({ page }) => {
    const input = page.getByPlaceholder("e.g., Account (SSE)");
    await expect(input).toBeVisible();
  });

  // ── Layout integrity ─────────────────────────────

  test("should render all 3 panels", async ({ page }) => {
    await expect(page.locator("h3", { hasText: "Upload & Context" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "Indexed Siebel Objects" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "SIF Generation" })).toBeVisible();
  });
});
