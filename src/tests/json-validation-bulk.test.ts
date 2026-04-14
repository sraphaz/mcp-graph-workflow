import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { ValidationError } from "../core/utils/errors.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("JSON validation in bulkInsert/mergeInsert", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── AC1: invalid JSON throws ValidationError before insert ──

  describe("circular references", () => {
    it("should throw ValidationError for circular reference in metadata via bulkInsert", () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      const node = makeNode({ metadata: circular });

      expect(() => store.bulkInsert([node], [])).toThrow(ValidationError);
      // Atomic: no nodes inserted on failure
      expect(store.getAllNodes()).toHaveLength(0);
    });

    it("should throw ValidationError for circular reference in metadata via mergeInsert", () => {
      const circular: Record<string, unknown> = { b: 2 };
      circular.loop = circular;

      const node = makeNode({ metadata: circular });

      expect(() => store.mergeInsert([node], [])).toThrow(ValidationError);
      expect(store.getAllNodes()).toHaveLength(0);
    });

    it("should throw ValidationError for circular reference in edge metadata via bulkInsert", () => {
      const n1 = makeNode();
      const n2 = makeNode();
      store.insertNode(n1);
      store.insertNode(n2);

      const circular: Record<string, unknown> = { x: 1 };
      circular.ref = circular;

      const edge = makeEdge(n1.id, n2.id, { metadata: circular });

      expect(() => store.bulkInsert([], [edge])).toThrow(ValidationError);
      expect(store.getAllEdges()).toHaveLength(0);
    });
  });

  // ── AC2: circular references caught and logged ──
  // (The ValidationError message should mention circular/serialization)

  describe("circular reference error messages", () => {
    it("should include field name in the ValidationError message", () => {
      const circular: Record<string, unknown> = { val: 1 };
      circular.self = circular;

      const node = makeNode({ metadata: circular });

      try {
        store.bulkInsert([node], []);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).message).toMatch(/metadata/i);
      }
    });
  });

  // ── AC3: NaN/Infinity values sanitized ──

  describe("NaN/Infinity sanitization", () => {
    it("should sanitize NaN values in metadata and still insert", () => {
      const node = makeNode({ metadata: { value: NaN, name: "test" } });

      store.bulkInsert([node], []);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.metadata).toBeDefined();
      // NaN should be sanitized to null
      expect(retrieved!.metadata!.value).toBeNull();
      expect(retrieved!.metadata!.name).toBe("test");
    });

    it("should sanitize Infinity values in metadata and still insert", () => {
      const node = makeNode({ metadata: { score: Infinity, label: "ok" } });

      store.bulkInsert([node], []);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.metadata!.score).toBeNull();
      expect(retrieved!.metadata!.label).toBe("ok");
    });

    it("should sanitize -Infinity values in metadata via mergeInsert", () => {
      const node = makeNode({ metadata: { rate: -Infinity, active: true } });

      const result = store.mergeInsert([node], []);

      expect(result.nodesInserted).toBe(1);
      const retrieved = store.getNodeById(node.id);
      expect(retrieved!.metadata!.rate).toBeNull();
      expect(retrieved!.metadata!.active).toBe(true);
    });

    it("should sanitize NaN in tags array", () => {
      // Tags are string arrays normally, but metadata can have NaN in nested structures
      const node = makeNode({ metadata: { scores: [1, NaN, 3] } });

      store.bulkInsert([node], []);

      const retrieved = store.getNodeById(node.id);
      expect(retrieved!.metadata!.scores).toEqual([1, null, 3]);
    });
  });

  // ── Mixed scenarios ──

  describe("mixed valid and invalid nodes", () => {
    it("should reject entire batch if any node has circular reference (atomic)", () => {
      const validNode = makeNode({ metadata: { ok: true } });
      const circular: Record<string, unknown> = { bad: true };
      circular.self = circular;
      const invalidNode = makeNode({ metadata: circular });

      expect(() => store.bulkInsert([validNode, invalidNode], [])).toThrow(ValidationError);
      // Atomic: neither node should be inserted
      expect(store.getAllNodes()).toHaveLength(0);
    });

    it("should accept batch where all nodes have valid JSON", () => {
      const n1 = makeNode({ metadata: { a: 1 } });
      const n2 = makeNode({ metadata: { b: "hello" } });
      const n3 = makeNode({ metadata: { c: [1, 2, 3] } });

      store.bulkInsert([n1, n2, n3], []);

      expect(store.getAllNodes()).toHaveLength(3);
    });
  });
});
