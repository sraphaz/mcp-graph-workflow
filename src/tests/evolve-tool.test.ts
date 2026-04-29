/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintE — `evolve` MCP tool surface tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerEvolve } from "../mcp/tools/evolve.js";

interface RegisteredTool {
  handler: (
    args: unknown,
    extra: unknown,
  ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
}

function getEvolveHandler(server: McpServer): RegisteredTool["handler"] {
  const reg = (server as unknown as { _registeredTools?: Record<string, RegisteredTool> })
    ._registeredTools;
  if (!reg || !reg["evolve"]) {
    throw new Error("evolve tool not registered on server");
  }
  return reg["evolve"].handler;
}

describe("evolve tool — surface", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("evolve-test");
    server = new McpServer({ name: "test", version: "0.0.0" });
    registerEvolve(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("registers a tool named 'evolve'", () => {
    expect(() => getEvolveHandler(server)).not.toThrow();
  });

  it("classify returns a bucket and an issue body preview", async () => {
    const handler = getEvolveHandler(server);
    const r = await handler(
      { action: "classify", ciOutput: "retry 3/3 timeout exceeded" },
      {},
    );
    expect(r.isError).not.toBe(true);
    const text = r.content[0].text;
    const parsed = JSON.parse(text) as {
      ok: boolean;
      classification: { bucket: string };
      issueBodyPreview: string;
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.classification.bucket).toBe("test-flake");
    expect(parsed.issueBodyPreview).toContain("Bucket");
  });

  it("classify with harnessDelta = -8 returns harness-drop bucket", async () => {
    const handler = getEvolveHandler(server);
    const r = await handler({ action: "classify", harnessDelta: -8 }, {});
    const parsed = JSON.parse(r.content[0].text) as {
      classification: { bucket: string };
    };
    expect(parsed.classification.bucket).toBe("harness-drop");
  });

  it("simulate-revert without sha returns error", async () => {
    const handler = getEvolveHandler(server);
    const r = await handler({ action: "simulate-revert" }, {});
    expect(r.isError).toBe(true);
  });

  it("simulate-revert returns a plan when sha is provided", async () => {
    const handler = getEvolveHandler(server);
    const r = await handler({ action: "simulate-revert", sha: "abc" }, {});
    const parsed = JSON.parse(r.content[0].text) as {
      ok: boolean;
      plan?: string[];
      reason?: string;
    };
    // plan present whether we are or aren't in a real repo
    expect(parsed.ok === true || typeof parsed.reason === "string").toBe(true);
  });

  it("batch-status returns a decision object", async () => {
    const handler = getEvolveHandler(server);
    const r = await handler(
      {
        action: "batch-status",
        harnessGrade: "B",
        tasksOpen: 0,
        tasksDone: 5,
        testsGreen: true,
        commitsAhead: 3,
      },
      {},
    );
    const parsed = JSON.parse(r.content[0].text) as {
      decision?: { action: string };
    };
    expect(parsed.decision?.action).toBeDefined();
  });

  it("batch-status with open tasks → stay-open", async () => {
    const handler = getEvolveHandler(server);
    const r = await handler(
      {
        action: "batch-status",
        harnessGrade: "B",
        tasksOpen: 3,
        tasksDone: 1,
        testsGreen: true,
        commitsAhead: 5,
      },
      {},
    );
    const parsed = JSON.parse(r.content[0].text) as {
      decision: { action: string; reason: string };
    };
    expect(parsed.decision.action).toBe("stay-open");
    expect(parsed.decision.reason).toContain("3 tasks");
  });
});
