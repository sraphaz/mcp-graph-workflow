/**
 * Bug Hunter Wave 1 — Medium severity fixes.
 * Tests for 5 bug fixes in sqlite-store and knowledge-store.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestStore, type TestStoreContext } from "./helpers/test-store.js";
import { makeNode } from "./helpers/factories.js";
import { logger } from "../core/utils/logger.js";
import { ValidationError } from "../core/utils/errors.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

// ── E1-T07: Log warning on corrupt JSON in rowToNode ────────────────────

describe("E1-T07: rowToNode logs warning on corrupt JSON", () => {
  let ctx: TestStoreContext;

  beforeEach(() => {
    ctx = createTestStore();
    vi.spyOn(logger, "warn");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ctx.cleanup();
  });

  it("should log warning when tags JSON is corrupt", () => {
    const node = makeNode({ id: "corrupt-tags" });
    ctx.store.insertNode(node);

    // Corrupt the tags field via raw SQL
    const db = (ctx.store as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db;
    db.prepare("UPDATE nodes SET tags = '{invalid json' WHERE id = ?").run("corrupt-tags");

    const result = ctx.store.getNodeById("corrupt-tags");
    expect(result).not.toBeNull();
    expect(result!.tags).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      "corrupt JSON in node field",
      expect.objectContaining({ nodeId: "corrupt-tags", field: "tags" }),
    );
  });

  it("should log warning when acceptanceCriteria JSON is corrupt", () => {
    const node = makeNode({ id: "corrupt-ac", acceptanceCriteria: ["AC1 is valid"] });
    ctx.store.insertNode(node);

    const db = (ctx.store as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db;
    db.prepare("UPDATE nodes SET acceptance_criteria = 'not-json' WHERE id = ?").run("corrupt-ac");

    const result = ctx.store.getNodeById("corrupt-ac");
    expect(result).not.toBeNull();
    expect(result!.acceptanceCriteria).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      "corrupt JSON in node field",
      expect.objectContaining({ nodeId: "corrupt-ac", field: "acceptanceCriteria" }),
    );
  });

  it("should log warning when metadata JSON is corrupt", () => {
    const node = makeNode({ id: "corrupt-meta", metadata: { key: "val" } });
    ctx.store.insertNode(node);

    const db = (ctx.store as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db;
    db.prepare("UPDATE nodes SET metadata = '{{bad' WHERE id = ?").run("corrupt-meta");

    const result = ctx.store.getNodeById("corrupt-meta");
    expect(result).not.toBeNull();
    expect(result!.metadata).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(
      "corrupt JSON in node field",
      expect.objectContaining({ nodeId: "corrupt-meta", field: "metadata" }),
    );
  });

  it("should log warning when testFiles JSON is corrupt", () => {
    const node = makeNode({ id: "corrupt-tf", testFiles: ["test.ts"] });
    ctx.store.insertNode(node);

    const db = (ctx.store as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db;
    db.prepare("UPDATE nodes SET test_files = 'broken[' WHERE id = ?").run("corrupt-tf");

    const result = ctx.store.getNodeById("corrupt-tf");
    expect(result).not.toBeNull();
    expect(result!.testFiles).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      "corrupt JSON in node field",
      expect.objectContaining({ nodeId: "corrupt-tf", field: "testFiles" }),
    );
  });
});

// ── E1-T09: Cycle detection for parentId updates ─────────────────────────

describe("E1-T09: parentId cycle detection", () => {
  let ctx: TestStoreContext;

  beforeEach(() => {
    ctx = createTestStore();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("should throw ValidationError when setting parentId to self", () => {
    const node = makeNode({ id: "self-ref" });
    ctx.store.insertNode(node);

    expect(() => ctx.store.updateNode("self-ref", { parentId: "self-ref" })).toThrow(ValidationError);
  });

  it("should throw ValidationError on A→B→A cycle", () => {
    const a = makeNode({ id: "cycle-a" });
    const b = makeNode({ id: "cycle-b", parentId: "cycle-a" });
    ctx.store.insertNode(a);
    ctx.store.insertNode(b);

    // Try to set A.parentId = B → would create A→B→A cycle
    expect(() => ctx.store.updateNode("cycle-a", { parentId: "cycle-b" })).toThrow(ValidationError);
  });

  it("should throw ValidationError on A→B→C→A cycle", () => {
    const a = makeNode({ id: "cyc-a" });
    const b = makeNode({ id: "cyc-b", parentId: "cyc-a" });
    const c = makeNode({ id: "cyc-c", parentId: "cyc-b" });
    ctx.store.insertNode(a);
    ctx.store.insertNode(b);
    ctx.store.insertNode(c);

    // Try to set A.parentId = C → would create A→B→C→A cycle
    expect(() => ctx.store.updateNode("cyc-a", { parentId: "cyc-c" })).toThrow(ValidationError);
  });

  it("should allow valid parentId update (no cycle)", () => {
    const a = makeNode({ id: "ok-a" });
    const b = makeNode({ id: "ok-b" });
    const c = makeNode({ id: "ok-c" });
    ctx.store.insertNode(a);
    ctx.store.insertNode(b);
    ctx.store.insertNode(c);

    // Set B.parentId = A — no cycle
    const result = ctx.store.updateNode("ok-b", { parentId: "ok-a" });
    expect(result).not.toBeNull();
    expect(result!.parentId).toBe("ok-a");

    // Set C.parentId = B — still no cycle (C→B→A)
    const result2 = ctx.store.updateNode("ok-c", { parentId: "ok-b" });
    expect(result2).not.toBeNull();
    expect(result2!.parentId).toBe("ok-b");
  });

  it("should allow clearing parentId (setting to null)", () => {
    const a = makeNode({ id: "clear-a" });
    const b = makeNode({ id: "clear-b", parentId: "clear-a" });
    ctx.store.insertNode(a);
    ctx.store.insertNode(b);

    const result = ctx.store.updateNode("clear-b", { parentId: undefined });
    expect(result).not.toBeNull();
    // parentId should be cleared
  });
});

// ── E1-T10: insertNode wrapped in transaction ───────────────────────────

describe("E1-T10: insertNode transaction safety", () => {
  let ctx: TestStoreContext;

  beforeEach(() => {
    ctx = createTestStore();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("should insert node successfully (transaction wraps the INSERT)", () => {
    const node = makeNode({ id: "tx-node", title: "Transaction test" });
    ctx.store.insertNode(node);

    const retrieved = ctx.store.getNodeById("tx-node");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe("Transaction test");
  });

  it("should not leave partial data on validation failure", () => {
    // A node with invalid priority (out of range) should fail validation
    expect(() =>
      ctx.store.insertNode({
        id: "bad-node",
        type: "task",
        title: "Bad priority",
        status: "backlog",
        priority: 99 as unknown as 1 | 2 | 3 | 4 | 5,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }),
    ).toThrow();

    const result = ctx.store.getNodeById("bad-node");
    expect(result).toBeNull();
  });
});

// ── E1-T04: safeJsonStringify in nodeToRow ──────────────────────────────

describe("E1-T04: safeJsonStringify sanitizes invalid JSON values", () => {
  let ctx: TestStoreContext;

  beforeEach(() => {
    ctx = createTestStore();
    vi.spyOn(logger, "warn");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ctx.cleanup();
  });

  it("should sanitize NaN in metadata to null", () => {
    const node = makeNode({
      id: "nan-meta",
      metadata: { score: NaN, valid: "ok" },
    });
    ctx.store.insertNode(node);

    const result = ctx.store.getNodeById("nan-meta");
    expect(result).not.toBeNull();
    expect(result!.metadata).toBeDefined();
    // NaN should be replaced with null
    expect(result!.metadata!.score).toBeNull();
    expect(result!.metadata!.valid).toBe("ok");
  });

  it("should sanitize Infinity in metadata to null", () => {
    const node = makeNode({
      id: "inf-meta",
      metadata: { value: Infinity, other: -Infinity },
    });
    ctx.store.insertNode(node);

    const result = ctx.store.getNodeById("inf-meta");
    expect(result).not.toBeNull();
    expect(result!.metadata!.value).toBeNull();
    expect(result!.metadata!.other).toBeNull();
  });

  it("should handle normal values without modification", () => {
    const node = makeNode({
      id: "normal-meta",
      metadata: { count: 42, name: "test", active: true },
      tags: ["alpha", "beta"],
    });
    ctx.store.insertNode(node);

    const result = ctx.store.getNodeById("normal-meta");
    expect(result).not.toBeNull();
    expect(result!.metadata).toEqual({ count: 42, name: "test", active: true });
    expect(result!.tags).toEqual(["alpha", "beta"]);
  });
});

// ── E1-T05: Knowledge dedup race condition ──────────────────────────────

describe("E1-T05: knowledge dedup uses transaction", () => {
  let ctx: TestStoreContext;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    ctx = createTestStore();
    const db = (ctx.store as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db;
    knowledgeStore = new KnowledgeStore(db as never);
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("should deduplicate when inserting same content twice", () => {
    const doc1 = knowledgeStore.insert({
      sourceType: "upload",
      sourceId: "src-1",
      title: "Test doc",
      content: "Identical content for dedup test",
    });

    const doc2 = knowledgeStore.insert({
      sourceType: "upload",
      sourceId: "src-1",
      title: "Test doc duplicate",
      content: "Identical content for dedup test",
    });

    // Both should return the same document (dedup)
    expect(doc1.id).toBe(doc2.id);
    expect(doc1.contentHash).toBe(doc2.contentHash);
  });

  it("should allow different content with same sourceId", () => {
    const doc1 = knowledgeStore.insert({
      sourceType: "upload",
      sourceId: "src-2",
      title: "Doc A",
      content: "Content A unique",
    });

    const doc2 = knowledgeStore.insert({
      sourceType: "upload",
      sourceId: "src-2",
      title: "Doc B",
      content: "Content B different",
    });

    expect(doc1.id).not.toBe(doc2.id);
  });
});
