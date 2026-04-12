import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { buildTieredContext } from "../core/context/tiered-context.js";

describe("Tiered Context L0-L3", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    const now = new Date().toISOString();
    store.insertNode({
      id: "node1",
      type: "task",
      title: "Implement feature X with detailed requirements",
      status: "in_progress",
      priority: 2,
      description: "This task involves implementing feature X. It requires changes to the store layer and the API layer. Must follow TDD methodology.",
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    store.close();
  });

  it("should support 'summary' tier (L0 ~20 tok)", () => {
    const ctx = buildTieredContext(store, "node1", "summary");
    expect(ctx).not.toBeNull();
    expect(ctx!.tier).toBe("summary");
    expect(ctx!.summary.id).toBe("node1");
    expect(ctx!.taskContext).toBeUndefined();
    expect(ctx!.estimatedTokens).toBeLessThan(65);
  });

  it("should support 'brief' tier (L1 ~80 tok)", () => {
    const ctx = buildTieredContext(store, "node1", "brief");
    expect(ctx).not.toBeNull();
    expect(ctx!.tier).toBe("brief");
    expect(ctx!.summary.id).toBe("node1");
    // brief includes description but not full TaskContext
    expect(ctx!.taskContext).toBeUndefined();
    expect(ctx!.estimatedTokens).toBeGreaterThan(20);
    expect(ctx!.estimatedTokens).toBeLessThan(200);
  });

  it("should support 'standard' tier (L2 ~150 tok)", () => {
    const ctx = buildTieredContext(store, "node1", "standard");
    expect(ctx).not.toBeNull();
    expect(ctx!.tier).toBe("standard");
    expect(ctx!.taskContext).toBeDefined();
  });

  it("should support 'deep' tier (L3 ~500+ tok)", () => {
    const ctx = buildTieredContext(store, "node1", "deep");
    expect(ctx).not.toBeNull();
    expect(ctx!.tier).toBe("deep");
    expect(ctx!.taskContext).toBeDefined();
  });

  it("brief should include description in summary", () => {
    const ctx = buildTieredContext(store, "node1", "brief");
    expect(ctx).not.toBeNull();
    // brief summary should have description
    expect(ctx!.summary.description).toContain("feature X");
  });

  it("summary should NOT include description", () => {
    const ctx = buildTieredContext(store, "node1", "summary");
    expect(ctx).not.toBeNull();
    expect(ctx!.summary.description).toBeUndefined();
  });

  it("brief should produce more tokens than summary but fewer than standard", () => {
    const l0 = buildTieredContext(store, "node1", "summary")!;
    const l1 = buildTieredContext(store, "node1", "brief")!;
    const l2 = buildTieredContext(store, "node1", "standard")!;

    expect(l1.estimatedTokens).toBeGreaterThan(l0.estimatedTokens);
    expect(l1.estimatedTokens).toBeLessThan(l2.estimatedTokens);
  });
});
