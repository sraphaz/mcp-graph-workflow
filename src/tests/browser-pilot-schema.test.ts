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
import {
  BrowserPilotInputSchema,
  BrowserPilotOutputSchema,
  BrowserPilotErrorSchema,
  BROWSER_PILOT_ERROR_CODES,
  BROWSER_PILOT_MODELS,
  type BrowserPilotInput,
  type BrowserPilotOutput,
  type BrowserPilotError,
} from "../schemas/browser-pilot.schema.js";

describe("BrowserPilotInputSchema — Copilot Bridge Sprint 1 Task 9", () => {
  it("accepts a minimal input (prompt only)", () => {
    const r = BrowserPilotInputSchema.safeParse({ prompt: "open google.com" });
    expect(r.success).toBe(true);
    if (r.success) {
      // Defaults applied:
      expect(r.data.maxSteps).toBe(25);
      expect(r.data.screenshotMode).toBe("key_steps");
      expect(r.data.timeoutMs).toBe(180_000);
    }
  });

  it("rejects empty prompt", () => {
    expect(BrowserPilotInputSchema.safeParse({ prompt: "" }).success).toBe(false);
  });

  it("rejects missing prompt", () => {
    expect(BrowserPilotInputSchema.safeParse({}).success).toBe(false);
  });

  it("accepts optional wsEndpoint, sessionId, allowedDomains", () => {
    const r = BrowserPilotInputSchema.safeParse({
      prompt: "find pricing",
      wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/abc",
      sessionId: "sess_1",
      allowedDomains: ["github.com", "*.example.com"],
    });
    expect(r.success).toBe(true);
  });

  it("accepts every declared model", () => {
    for (const m of BROWSER_PILOT_MODELS) {
      const r = BrowserPilotInputSchema.safeParse({ prompt: "x", model: m });
      expect(r.success, `model ${m} must be accepted`).toBe(true);
    }
  });

  it("rejects unknown model", () => {
    const r = BrowserPilotInputSchema.safeParse({ prompt: "x", model: "gpt-5-turbo-omega" });
    expect(r.success).toBe(false);
  });

  it("rejects maxSteps out of range", () => {
    expect(BrowserPilotInputSchema.safeParse({ prompt: "x", maxSteps: 0 }).success).toBe(false);
    expect(BrowserPilotInputSchema.safeParse({ prompt: "x", maxSteps: 101 }).success).toBe(false);
    expect(BrowserPilotInputSchema.safeParse({ prompt: "x", maxSteps: 50 }).success).toBe(true);
  });

  it("accepts every screenshotMode", () => {
    for (const mode of ["none", "key_steps", "every_step"] as const) {
      expect(BrowserPilotInputSchema.safeParse({ prompt: "x", screenshotMode: mode }).success).toBe(true);
    }
  });

  it("rejects unknown screenshotMode", () => {
    expect(BrowserPilotInputSchema.safeParse({ prompt: "x", screenshotMode: "video" }).success).toBe(false);
  });

  it("rejects negative or zero timeoutMs", () => {
    expect(BrowserPilotInputSchema.safeParse({ prompt: "x", timeoutMs: 0 }).success).toBe(false);
    expect(BrowserPilotInputSchema.safeParse({ prompt: "x", timeoutMs: -1 }).success).toBe(false);
  });
});

describe("BrowserPilotOutputSchema — success shape", () => {
  it("accepts a complete success payload", () => {
    const payload: BrowserPilotOutput = {
      success: true,
      result: "Top tabs: Home, About, Pricing.",
      actionLog: [
        { step: 1, tool: "navigate", args: { url: "http://x" }, observation: "loaded" },
        { step: 2, tool: "extract_text", args: { selector: "nav a" }, observation: "Home, About, Pricing" },
      ],
      screenshots: [{ step: 2, uri: "screenshots/step-2.png" }],
      tokens: { prompt: 1500, completion: 200, total: 1700 },
      model: "claude-3.5-sonnet",
      durationMs: 12_345,
      runId: "run_01J0X...",
    };
    expect(BrowserPilotOutputSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects success=false in success schema", () => {
    expect(
      BrowserPilotOutputSchema.safeParse({
        success: false,
        result: "x",
        actionLog: [],
        screenshots: [],
        tokens: { prompt: 0, completion: 0, total: 0 },
        model: "x",
        durationMs: 0,
        runId: "x",
      }).success,
    ).toBe(false);
  });

  it("requires non-negative tokens", () => {
    expect(
      BrowserPilotOutputSchema.safeParse({
        success: true,
        result: "x",
        actionLog: [],
        screenshots: [],
        tokens: { prompt: -1, completion: 0, total: 0 },
        model: "x",
        durationMs: 0,
        runId: "x",
      }).success,
    ).toBe(false);
  });

  it("accepts empty actionLog and screenshots", () => {
    expect(
      BrowserPilotOutputSchema.safeParse({
        success: true,
        result: "no-op",
        actionLog: [],
        screenshots: [],
        tokens: { prompt: 0, completion: 0, total: 0 },
        model: "x",
        durationMs: 0,
        runId: "r",
      }).success,
    ).toBe(true);
  });
});

describe("BrowserPilotErrorSchema — error shape", () => {
  it("includes all 8 error codes from the plan", () => {
    expect([...BROWSER_PILOT_ERROR_CODES].sort()).toEqual([
      "bridge_unreachable",
      "browser_use_crash",
      "cdp_ws_unreachable",
      "copilot_consent_denied",
      "copilot_unavailable",
      "domain_blocked",
      "quota_exceeded",
      "timeout",
    ]);
  });

  it("accepts every declared error code", () => {
    for (const code of BROWSER_PILOT_ERROR_CODES) {
      const payload: BrowserPilotError = {
        success: false,
        error: { code, message: "x", retriable: false },
      };
      expect(BrowserPilotErrorSchema.safeParse(payload).success, `code ${code}`).toBe(true);
    }
  });

  it("rejects unknown error code", () => {
    expect(
      BrowserPilotErrorSchema.safeParse({
        success: false,
        error: { code: "out_of_disk", message: "x", retriable: true },
      }).success,
    ).toBe(false);
  });

  it("requires retriable boolean", () => {
    expect(
      BrowserPilotErrorSchema.safeParse({
        success: false,
        error: { code: "timeout", message: "x" },
      }).success,
    ).toBe(false);
  });

  it("hint is optional", () => {
    expect(
      BrowserPilotErrorSchema.safeParse({
        success: false,
        error: { code: "timeout", message: "x", retriable: true, hint: "increase timeoutMs" },
      }).success,
    ).toBe(true);
  });
});

describe("Round-trip — input parse → use as input again", () => {
  it("Parsed defaults serialize back through the schema cleanly", () => {
    const minimal = BrowserPilotInputSchema.parse({ prompt: "find x" });
    const reparsed = BrowserPilotInputSchema.parse(minimal);
    expect(reparsed).toEqual(minimal);
  });

  it("BrowserPilotInput type is assignable from a valid object", () => {
    const value: BrowserPilotInput = {
      prompt: "x",
      maxSteps: 25,
      screenshotMode: "key_steps",
      timeoutMs: 180_000,
    };
    const r = BrowserPilotInputSchema.safeParse(value);
    expect(r.success).toBe(true);
  });
});
