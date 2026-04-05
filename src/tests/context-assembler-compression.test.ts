import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { assembleContext, invalidateAssemblerCache } from "../core/context/context-assembler.js";

describe("context-assembler compression", () => {
  let store: SqliteStore;

  beforeEach(() => {
    invalidateAssemblerCache();
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    const now = new Date().toISOString();
    store.insertNode({
      id: "node1",
      type: "task",
      title: "Implement TypeScript compiler optimization features",
      status: "in_progress",
      priority: 2,
      description: "This is a task about implementing TypeScript compiler. It has many details and various requirements that need to be addressed.",
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    store.close();
  });

  it("should include _compression stats when compress:true", () => {
    const result = assembleContext(store, "TypeScript compiler", {
      tokenBudget: 4000,
      tier: "standard",
      compress: true,
    });

    expect(result._compression).toBeDefined();
    expect(result._compression!.inputTokens).toBeGreaterThanOrEqual(0);
    expect(result._compression!.outputTokens).toBeGreaterThanOrEqual(0);
    expect(typeof result._compression!.reductionPercent).toBe("number");
  });

  it("should NOT include _compression when compress:false", () => {
    const result = assembleContext(store, "TypeScript compiler", {
      tokenBudget: 4000,
      tier: "standard",
      compress: false,
    });

    expect(result._compression).toBeUndefined();
  });

  it("should NOT include _compression when compress is not set", () => {
    const result = assembleContext(store, "TypeScript compiler", {
      tokenBudget: 4000,
      tier: "standard",
    });

    expect(result._compression).toBeUndefined();
  });

  it("should have same or fewer tokens when compress:true vs compress:false", () => {
    const withoutCompress = assembleContext(store, "TypeScript", {
      tokenBudget: 4000,
      tier: "standard",
      compress: false,
    });

    const withCompress = assembleContext(store, "TypeScript", {
      tokenBudget: 4000,
      tier: "standard",
      compress: true,
    });

    // With compression, tokens used should be <= without compression
    expect(withCompress.tokenUsage.used).toBeLessThanOrEqual(
      withoutCompress.tokenUsage.used,
    );
  });
});
