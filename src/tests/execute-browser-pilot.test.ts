/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, expect, it, vi } from "vitest";
import { executeBrowserPilot } from "../core/browser-pilot/execute-browser-pilot.js";
import { BrowserPilotInputSchema } from "../schemas/browser-pilot.schema.js";

const validInput = BrowserPilotInputSchema.parse({
  prompt: "Open the dashboard and list visible tabs",
  wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/abc",
  model: "claude-3.5-sonnet",
});

function makeBaseDeps() {
  return {
    ensureBridgeReady: vi.fn().mockResolvedValue(undefined),
    resolveWsEndpoint: vi
      .fn()
      .mockResolvedValue("ws://127.0.0.1:9222/devtools/browser/abc"),
    spawnAgent: vi.fn().mockResolvedValue({
      result: "Tabs: Visualize, Intelligence, Tools, System",
      actionLog: [
        {
          step: 0,
          tool: "navigate",
          args: { url: "http://localhost:3377/" },
          observation: "loaded",
        },
      ],
      screenshots: [{ step: 0, uri: "/tmp/shot-0.png" }],
      tokens: { prompt: 500, completion: 200, total: 700 },
      model: "claude-3.5-sonnet",
    }),
    now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(3_500),
    generateRunId: vi.fn().mockReturnValue("run-abc123"),
    defaultModel: "claude-3.5-sonnet",
    bridgeBaseUrl: "http://127.0.0.1:9876/v1",
  };
}

describe("executeBrowserPilot — happy path", () => {
  it("returns success with full output, runId, durationMs computed", async () => {
    const deps = makeBaseDeps();

    const result = await executeBrowserPilot(validInput, deps);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.runId).toBe("run-abc123");
      expect(result.durationMs).toBe(2500);
      expect(result.result).toContain("Visualize");
      expect(result.tokens.total).toBe(700);
      expect(result.actionLog).toHaveLength(1);
      expect(result.screenshots).toHaveLength(1);
      expect(result.model).toBe("claude-3.5-sonnet");
    }
    expect(deps.ensureBridgeReady).toHaveBeenCalledOnce();
    expect(deps.spawnAgent).toHaveBeenCalledOnce();
  });
});

describe("executeBrowserPilot — error mapping", () => {
  it("bridge_unreachable when ensureBridgeReady throws", async () => {
    const deps = makeBaseDeps();
    deps.ensureBridgeReady.mockRejectedValue(new Error("ECONNREFUSED :9876"));

    const result = await executeBrowserPilot(validInput, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("bridge_unreachable");
      expect(result.error.retriable).toBe(true);
    }
    expect(deps.spawnAgent).not.toHaveBeenCalled();
  });

  it("cdp_ws_unreachable when resolveWsEndpoint throws", async () => {
    const deps = makeBaseDeps();
    deps.resolveWsEndpoint.mockRejectedValue(new Error("no ws endpoint"));
    const inputWithoutWs = BrowserPilotInputSchema.parse({
      prompt: "do thing",
    });

    const result = await executeBrowserPilot(inputWithoutWs, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("cdp_ws_unreachable");
    }
    expect(deps.spawnAgent).not.toHaveBeenCalled();
  });

  it("browser_use_crash on generic spawnAgent throw", async () => {
    const deps = makeBaseDeps();
    deps.spawnAgent.mockRejectedValue(new Error("python child died"));

    const result = await executeBrowserPilot(validInput, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("browser_use_crash");
    }
  });

  it("preserves known error codes thrown by spawnAgent (e.g. domain_blocked)", async () => {
    const deps = makeBaseDeps();
    const tagged: Error & { code?: string } = new Error("blocked: foo.bar");
    tagged.code = "domain_blocked";
    deps.spawnAgent.mockRejectedValue(tagged);

    const result = await executeBrowserPilot(validInput, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("domain_blocked");
      expect(result.error.retriable).toBe(false);
    }
  });

  it("preserves quota_exceeded code from spawnAgent", async () => {
    const deps = makeBaseDeps();
    const tagged: Error & { code?: string } = new Error("over quota");
    tagged.code = "quota_exceeded";
    deps.spawnAgent.mockRejectedValue(tagged);

    const result = await executeBrowserPilot(validInput, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("quota_exceeded");
    }
  });
});
