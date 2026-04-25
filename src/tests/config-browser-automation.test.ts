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

import { describe, it, expect } from "vitest";
import { ConfigSchema } from "../core/config/config-schema.js";

describe("integrations.browserAutomation — Copilot Bridge Sprint 1 Task 8", () => {
  it("ConfigSchema parses an empty object and applies all defaults", () => {
    const r = ConfigSchema.safeParse({});
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.integrations.browserAutomation).toBeDefined();
    expect(r.data.integrations.browserAutomation.enabled).toBe(false);
    expect(r.data.integrations.browserAutomation.bridgeUrl).toBe("http://127.0.0.1:9876/v1");
    expect(r.data.integrations.browserAutomation.defaultModel).toBe("claude-3.5-sonnet");
    expect(r.data.integrations.browserAutomation.allowedDomains).toEqual([]);
    expect(r.data.integrations.browserAutomation.forbiddenCdpMethods).toEqual(["Browser.close"]);
    expect(r.data.integrations.browserAutomation.maxStepsDefault).toBe(25);
  });

  it("accepts a fully-specified browserAutomation block", () => {
    const r = ConfigSchema.safeParse({
      integrations: {
        browserAutomation: {
          enabled: true,
          bridgeUrl: "http://bridge.local:9876/v1",
          defaultModel: "gpt-4o",
          defaultCdpUrl: "ws://browser.host:9222/devtools/browser/abc",
          allowedDomains: ["github.com"],
          forbiddenCdpMethods: ["Browser.close", "Page.crash"],
          maxStepsDefault: 50,
          tokenBudgetPerDay: 1_000_000,
        },
      },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.integrations.browserAutomation.enabled).toBe(true);
    expect(r.data.integrations.browserAutomation.tokenBudgetPerDay).toBe(1_000_000);
  });

  it("rejects bridgeUrl missing scheme", () => {
    const r = ConfigSchema.safeParse({
      integrations: { browserAutomation: { bridgeUrl: "127.0.0.1:9876/v1" } },
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown defaultModel (must be a known Copilot family)", () => {
    const r = ConfigSchema.safeParse({
      integrations: { browserAutomation: { defaultModel: "gpt-5-omega" } },
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative maxStepsDefault", () => {
    const r = ConfigSchema.safeParse({
      integrations: { browserAutomation: { maxStepsDefault: -1 } },
    });
    expect(r.success).toBe(false);
  });

  it("rejects maxStepsDefault > 100", () => {
    const r = ConfigSchema.safeParse({
      integrations: { browserAutomation: { maxStepsDefault: 101 } },
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative tokenBudgetPerDay", () => {
    const r = ConfigSchema.safeParse({
      integrations: { browserAutomation: { tokenBudgetPerDay: -100 } },
    });
    expect(r.success).toBe(false);
  });

  it("does not affect existing integrations defaults", () => {
    const r = ConfigSchema.parse({});
    // Sanity: Sprint 1 Task 8 must not change the surface of pre-existing fields.
    expect(r.integrations.codeGraphAutoIndex).toBe(true);
    expect(r.integrations.codeGraphReindexIntervalSec).toBe(0);
    expect(r.integrations.lspServers).toEqual([]);
  });

  it("accepts wildcards in allowedDomains (passed through verbatim)", () => {
    const r = ConfigSchema.safeParse({
      integrations: {
        browserAutomation: { allowedDomains: ["*.example.com", "internal.local"] },
      },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.integrations.browserAutomation.allowedDomains).toEqual([
      "*.example.com",
      "internal.local",
    ]);
  });
});
