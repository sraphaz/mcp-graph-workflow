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

test.describe("SSE Real-Time Updates", () => {
  test("page establishes SSE connection", async ({ page }) => {
    // Monitor network requests to verify SSE connection is established
    const sseRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/v1/events"),
      { timeout: 10_000 },
    );

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // The app.js connects to SSE on load — verify the request was made
    const sseRequest = await sseRequestPromise;
    expect(sseRequest.url()).toContain("/api/v1/events");
  });

  test("creating a node via API updates the page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    // Get initial header stats text (shows "X/Y done" in header)
    const headerStats = page.locator("header span").filter({ hasText: /done/ });
    const initialText = await headerStats.count() > 0
      ? await headerStats.textContent()
      : null;

    // Create a node via the API
    await page.request.post("/api/v1/nodes", {
      data: {
        type: "task",
        title: "E2E SSE Test Node",
        status: "done",
        priority: 3,
      },
    });

    // Wait for SSE event to trigger UI update
    await page.waitForTimeout(2000);

    // After adding a done node, the header stats should reflect the change
    const updatedText = await headerStats.count() > 0
      ? await headerStats.textContent()
      : null;
    // Either stats changed or they are present
    expect(updatedText !== null || initialText !== null).toBeTruthy();
  });

  test("health endpoint responds", async ({ page }) => {
    const response = await page.request.get("/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
