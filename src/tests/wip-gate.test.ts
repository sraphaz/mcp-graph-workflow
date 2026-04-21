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

/**
 * Tests for enforceWipAndFileGates — WIP-count only phase (Commit C).
 */

import { describe, it, expect, vi } from "vitest";
import { enforceWipAndFileGates, type WipGateOptions } from "../core/pipeline/wip-gate.js";
import { WIPLimitError } from "../core/utils/errors.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeStore(inProgressCount: number): SqliteStore {
  const nodes: GraphNode[] = Array.from({ length: inProgressCount }, (_, i) => ({
    id: `node-${i}`,
    type: "task",
    title: `Task ${i}`,
    status: "in_progress",
    priority: 2,
    blocked: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as GraphNode));

  return {
    getNodesByStatus: vi.fn((_status: string) => nodes),
  } as unknown as SqliteStore;
}

// ── AC: skips entirely when teamTask off ──────────────────────────────────

describe("enforceWipAndFileGates — teamTask off", () => {
  it("should skip without reading store when teamTask is false", () => {
    const store = makeStore(99);
    const opts: WipGateOptions = { teamTask: false, wipLimit: 1, wipStrict: true, nodeId: "new-task" };

    expect(() => enforceWipAndFileGates(store, opts)).not.toThrow();
    expect((store.getNodesByStatus as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

// ── AC: reads in_progress count from store ────────────────────────────────

describe("enforceWipAndFileGates — reads store", () => {
  it("should read in_progress nodes from store when teamTask is on", () => {
    const store = makeStore(0);
    const opts: WipGateOptions = { teamTask: true, wipLimit: 3, wipStrict: true, nodeId: "new-task" };

    enforceWipAndFileGates(store, opts);

    expect((store.getNodesByStatus as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("in_progress");
  });
});

// ── AC: throws WIPLimitError when count >= limit and wipStrict:true ───────

describe("enforceWipAndFileGates — strict mode", () => {
  it("should throw WIPLimitError when in_progress count equals wipLimit", () => {
    const store = makeStore(2);
    const opts: WipGateOptions = { teamTask: true, wipLimit: 2, wipStrict: true, nodeId: "new-task" };

    expect(() => enforceWipAndFileGates(store, opts)).toThrow(WIPLimitError);
  });

  it("should throw WIPLimitError when in_progress count exceeds wipLimit", () => {
    const store = makeStore(5);
    const opts: WipGateOptions = { teamTask: true, wipLimit: 2, wipStrict: true, nodeId: "new-task" };

    expect(() => enforceWipAndFileGates(store, opts)).toThrow(WIPLimitError);
  });

  it("should include current/limit in error details", () => {
    const store = makeStore(3);
    const opts: WipGateOptions = { teamTask: true, wipLimit: 2, wipStrict: true, nodeId: "new-task" };

    try {
      enforceWipAndFileGates(store, opts);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WIPLimitError);
      const wipErr = err as WIPLimitError;
      expect(wipErr.details.current).toBe(3);
      expect(wipErr.details.limit).toBe(2);
    }
  });

  it("should not throw when in_progress count is below wipLimit", () => {
    const store = makeStore(1);
    const opts: WipGateOptions = { teamTask: true, wipLimit: 2, wipStrict: true, nodeId: "new-task" };

    expect(() => enforceWipAndFileGates(store, opts)).not.toThrow();
  });
});

// ── AC: warns (no throw) when wipStrict:false ─────────────────────────────

describe("enforceWipAndFileGates — advisory mode", () => {
  it("should not throw when count >= limit and wipStrict is false", () => {
    const store = makeStore(5);
    const opts: WipGateOptions = { teamTask: true, wipLimit: 2, wipStrict: false, nodeId: "new-task" };

    expect(() => enforceWipAndFileGates(store, opts)).not.toThrow();
  });

  it("should return a warning when WIP limit would be exceeded in advisory mode", () => {
    const store = makeStore(3);
    const opts: WipGateOptions = { teamTask: true, wipLimit: 2, wipStrict: false, nodeId: "new-task" };

    const result = enforceWipAndFileGates(store, opts);

    expect(result.warning).toBeDefined();
    expect(result.warning).toContain("WIP");
  });

  it("should return no warning when under limit in advisory mode", () => {
    const store = makeStore(1);
    const opts: WipGateOptions = { teamTask: true, wipLimit: 2, wipStrict: false, nodeId: "new-task" };

    const result = enforceWipAndFileGates(store, opts);

    expect(result.warning).toBeUndefined();
  });
});
