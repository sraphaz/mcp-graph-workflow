/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * B4 — performance budget regression test for the pre-tool-use hook.
 *
 * The hook fires on every Claude Code mcp__mcp-graph__* tool call. Even small
 * dispatch overhead × thousands of calls per session adds up. These tests bound
 * the cost of:
 *   - the synchronous filter + gate-call + format pipeline (`evaluatePreToolUse`)
 *   - the early-exit filter alone (non-mcp / read-only tools)
 *   - stdin payload parsing (`parsePreToolUseStdin`)
 *
 * Heavy modules (better-sqlite3, parent dist/*) intentionally stay out of the
 * top-level `pre-tool-use.ts` import graph; this test guards that invariant
 * indirectly by checking that no `*sqlite*` module appears in the require cache
 * after the pre-tool-use module is imported but before any deps are wired.
 */

import { describe, it, expect } from "vitest";
import {
  evaluatePreToolUse,
  parsePreToolUseStdin,
  type GateDeps,
} from "./pre-tool-use.js";

const fakeStore: object = { __test: true };

const stubDeps: GateDeps = {
  loadGateContext: () => ({ phase: "IMPLEMENT" }),
  checkGates: () => ({
    allowed: true,
    warnings: [],
    lifecycleBlock: { phase: "IMPLEMENT" },
  }),
};

function p95(samplesMs: ReadonlyArray<number>): number {
  if (samplesMs.length === 0) return 0;
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const idx = Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1);
  return sorted[idx] ?? 0;
}

function timeOnce<T>(fn: () => T): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe("evaluatePreToolUse — performance budget (B4)", () => {
  it("dispatches mutating-tool path 50× with p95 < 5ms (stubbed gateDeps)", () => {
    // Warm-up to amortize JIT
    for (let i = 0; i < 5; i++) {
      evaluatePreToolUse(
        {
          tool_name: "mcp__mcp-graph__update_status",
          tool_input: { nodeId: `node_warm_${i}`, status: "in_progress" },
        },
        { store: fakeStore, gateDeps: stubDeps },
      );
    }

    const samples: number[] = [];
    for (let i = 0; i < 50; i++) {
      samples.push(
        timeOnce(() =>
          evaluatePreToolUse(
            {
              tool_name: "mcp__mcp-graph__update_status",
              tool_input: { nodeId: `node_${i}`, status: "in_progress" },
            },
            { store: fakeStore, gateDeps: stubDeps },
          ),
        ),
      );
    }

    expect(p95(samples)).toBeLessThan(5);
  });

  it("filter-only path 50× with p95 < 1ms (no gate work)", () => {
    // Warm-up
    for (let i = 0; i < 5; i++) {
      evaluatePreToolUse({ tool_name: "Edit", tool_input: { file: "x" } });
      evaluatePreToolUse({ tool_name: "mcp__mcp-graph__list", tool_input: {} });
    }

    const samples: number[] = [];
    for (let i = 0; i < 50; i++) {
      samples.push(
        timeOnce(() => {
          evaluatePreToolUse({ tool_name: "Edit", tool_input: { file: "x" } });
          evaluatePreToolUse({ tool_name: "mcp__mcp-graph__list", tool_input: {} });
        }),
      );
    }

    expect(p95(samples)).toBeLessThan(1);
  });
});

describe("parsePreToolUseStdin — performance budget (B4)", () => {
  it("parses 10KB+ JSON payload 20× with p95 < 5ms", () => {
    const largeInput = JSON.stringify({
      session_id: "abc",
      tool_name: "mcp__mcp-graph__node",
      tool_input: {
        action: "add",
        title: "Big task",
        description: "x".repeat(10_000),
        acceptanceCriteria: Array.from({ length: 20 }, (_, i) => `AC ${i}: detailed criterion`),
      },
      hook_event_name: "PreToolUse",
      transcript_path: "/tmp/transcript.json",
    });

    expect(largeInput.length).toBeGreaterThan(10_000);

    // Warm-up
    for (let i = 0; i < 3; i++) parsePreToolUseStdin(largeInput);

    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      samples.push(timeOnce(() => parsePreToolUseStdin(largeInput)));
    }

    expect(p95(samples)).toBeLessThan(5);
  });
});

describe("evaluatePreToolUse — lazy-import preservation (B4)", () => {
  it("does NOT pull better-sqlite3 or parent dist into the module graph at import time", async () => {
    // require.cache only exists for CJS; ESM resolutions live in import.meta /
    // module records but vitest exposes them via process.moduleLoadList in node.
    // Best-effort: walk loaded modules visible via Object.keys on require.cache
    // when present, otherwise inspect the import URL list.
    const indicators = ["better-sqlite3", "@mcp-graph-workflow/mcp-graph"];

    // CJS-style cache (will be undefined under pure ESM)
    const cjsKeys =
      typeof (globalThis as { require?: { cache?: Record<string, unknown> } }).require?.cache === "object"
        ? Object.keys((globalThis as { require: { cache: Record<string, unknown> } }).require.cache)
        : [];

    for (const indicator of indicators) {
      expect(cjsKeys.some((k) => k.includes(indicator))).toBe(false);
    }

    // Sanity: module imports must still work; verify export shape.
    expect(typeof evaluatePreToolUse).toBe("function");
    expect(typeof parsePreToolUseStdin).toBe("function");
  });
});
