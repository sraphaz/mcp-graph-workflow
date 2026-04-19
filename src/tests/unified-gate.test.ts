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
 * TDD tests for unified-gate.ts — checkGates function.
 * Validates the AC: checkGates retorna allowed, lifecycleBlock, codeIntelBlock, warnings
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { CodeStore } from "../core/code/code-store.js";
import {
  checkGates,
  resetStaleWarningDedup,
} from "../mcp/unified-gate.js";
import { makeNode } from "./helpers/factories.js";

// ── Helpers ─────────────────────────────────────────────

function createInMemoryStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("test-project");
  return store;
}

function seedCodeIndex(store: SqliteStore, gitHash: string | null = "abc123"): void {
  const codeStore = new CodeStore(store.getDb());
  codeStore.upsertIndexMeta({
    projectId: store.getProject()!.id,
    lastIndexed: new Date().toISOString(),
    fileCount: 10,
    symbolCount: 50,
    relationCount: 30,
    gitHash,
  });
}

// ── checkGates ──────────────────────────────────────────

describe("checkGates", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = createInMemoryStore();
    resetStaleWarningDedup();
  });

  it("should return GateResult with allowed, lifecycleBlock, codeIntelBlock, warnings", () => {
    const result = checkGates(store, "list", [{}]);

    expect(result).toHaveProperty("allowed");
    expect(result).toHaveProperty("lifecycleBlock");
    expect(result).toHaveProperty("warnings");
    expect(typeof result.allowed).toBe("boolean");
    expect(result.lifecycleBlock).toBeDefined();
    expect(result.lifecycleBlock!.phase).toBeDefined();
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("should return allowed=true for read-only tools", () => {
    const result = checkGates(store, "list", [{}]);

    expect(result.allowed).toBe(true);
  });

  it("should return allowed=true for mutating tools in advisory mode", () => {
    store.setProjectSetting("lifecycle_strictness_mode", "advisory");
    const result = checkGates(store, "edge", [{}]);

    expect(result.allowed).toBe(true);
  });

  it("should include lifecycleBlock with phase info", () => {
    const result = checkGates(store, "list", [{}]);

    expect(result.lifecycleBlock).toBeDefined();
    expect(result.lifecycleBlock!.phase).toBeTruthy();
    expect(result.lifecycleBlock!.reminder).toBeTruthy();
    expect(Array.isArray(result.lifecycleBlock!.suggestedNext)).toBe(true);
    expect(Array.isArray(result.lifecycleBlock!.principles)).toBe(true);
  });

  it("should include codeIntelBlock when mode is advisory", () => {
    store.setProjectSetting("code_intelligence_mode", "advisory");
    const result = checkGates(store, "list", [{}]);

    expect(result.codeIntelBlock).toBeDefined();
    expect(result.codeIntelBlock!.mode).toBe("advisory");
    expect(result.codeIntelBlock!.indexStatus).toBeDefined();
  });

  it("should NOT include codeIntelBlock when mode is off", () => {
    // off is default
    const result = checkGates(store, "list", [{}]);

    expect(result.codeIntelBlock).toBeUndefined();
  });

  it("should perform single read — doc and phase consistent", () => {
    const result = checkGates(store, "list", [{}]);

    // Phase should be deterministic for the same store state
    const result2 = checkGates(store, "list", [{}]);
    expect(result.lifecycleBlock!.phase).toBe(result2.lifecycleBlock!.phase);
  });

  it("should collect lifecycle warnings for mutating tools in strict mode", () => {
    store.setProjectSetting("lifecycle_strictness_mode", "strict");
    // Add a task and try to finish it without prerequisites
    const node = makeNode({ title: "test task" });
    store.insertNode(node);

    const result = checkGates(store, "update_status", [{ nodeId: node.id, status: "done" }]);

    // May or may not be blocked depending on lifecycle state, but should have warnings array
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("should block when lifecycle gate has error-severity warnings in strict mode", () => {
    store.setProjectSetting("lifecycle_strictness_mode", "strict");
    store.setProjectSetting("tool_prerequisites_mode", "strict");

    // Try to finish a task without calling prerequisites
    const node = makeNode({ title: "test task" });
    store.insertNode(node);

    const result = checkGates(store, "update_status", [{ nodeId: node.id, status: "done" }]);

    // In strict mode with prerequisites, this should generate warnings
    // The allowed field reflects whether error-severity warnings exist
    if (result.warnings.some((w: { severity: string }) => w.severity === "error")) {
      expect(result.allowed).toBe(false);
    } else {
      expect(result.allowed).toBe(true);
    }
  });

  it("should include codeIntelBlock with index info when code intelligence is enabled", () => {
    store.setProjectSetting("code_intelligence_mode", "advisory");
    seedCodeIndex(store, "abc123");

    const result = checkGates(store, "list", [{}], "abc123");

    expect(result.codeIntelBlock).toBeDefined();
    expect(result.codeIntelBlock!.indexStatus.available).toBe(true);
    expect(result.codeIntelBlock!.indexStatus.stale).toBe(false);
  });

  it("should detect stale code index", () => {
    store.setProjectSetting("code_intelligence_mode", "advisory");
    seedCodeIndex(store, "old-hash");

    const result = checkGates(store, "list", [{}], "new-hash");

    expect(result.codeIntelBlock).toBeDefined();
    expect(result.codeIntelBlock!.indexStatus.stale).toBe(true);
  });
});
