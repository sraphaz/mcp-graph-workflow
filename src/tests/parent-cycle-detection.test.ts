import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { ValidationError } from "../core/utils/errors.js";
import { makeNode } from "./helpers/factories.js";

describe("Parent cycle detection (E1-T09)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── AC3: self-referencing parentId rejected ──

  describe("self-referencing parentId", () => {
    it("should throw ValidationError when updateNode sets parentId to self", () => {
      const node = makeNode();
      store.insertNode(node);

      expect(() => store.updateNode(node.id, { parentId: node.id })).toThrow(ValidationError);
    });

    it("should throw ValidationError when insertNode sets parentId to self", () => {
      const node = makeNode();
      node.parentId = node.id;

      expect(() => store.insertNode(node)).toThrow(ValidationError);
    });
  });

  // ── AC1: setting parentId that creates cycle throws ValidationError ──

  describe("cycle detection via updateNode", () => {
    it("should throw ValidationError for depth-2 cycle (A→B→A)", () => {
      const a = makeNode();
      const b = makeNode({ parentId: a.id });
      store.insertNode(a);
      store.insertNode(b);

      // Trying to make A's parent be B creates: A→B→A
      expect(() => store.updateNode(a.id, { parentId: b.id })).toThrow(ValidationError);
    });

    it("should throw ValidationError for depth-3 cycle (A→B→C→A)", () => {
      const a = makeNode();
      const b = makeNode({ parentId: a.id });
      const c = makeNode({ parentId: b.id });
      store.insertNode(a);
      store.insertNode(b);
      store.insertNode(c);

      // Trying to make A's parent be C creates: A→C→B→A
      expect(() => store.updateNode(a.id, { parentId: c.id })).toThrow(ValidationError);
    });

    it("should throw ValidationError for depth-N cycle (chain of 5)", () => {
      const nodes = Array.from({ length: 5 }, () => makeNode());
      store.insertNode(nodes[0]);
      for (let i = 1; i < nodes.length; i++) {
        nodes[i].parentId = nodes[i - 1].id;
        store.insertNode(nodes[i]);
      }
      // Chain: n0 ← n1 ← n2 ← n3 ← n4
      // Trying to make n0's parent be n4 creates a cycle
      expect(() => store.updateNode(nodes[0].id, { parentId: nodes[4].id })).toThrow(ValidationError);
    });
  });

  // ── AC2: cycles of depth 2, 3, and N detected ──
  // (Covered by the tests above, plus additional non-cycle validations below)

  describe("valid parentId updates (no cycle)", () => {
    it("should allow setting parentId to a non-ancestor node", () => {
      const a = makeNode();
      const b = makeNode();
      const c = makeNode({ parentId: a.id });
      store.insertNode(a);
      store.insertNode(b);
      store.insertNode(c);

      // b is not in c's parent chain, so this is safe
      const updated = store.updateNode(c.id, { parentId: b.id });
      expect(updated).toBeDefined();
      expect(updated!.parentId).toBe(b.id);
    });

    it("should allow clearing parentId (setting to null)", () => {
      const parent = makeNode();
      const child = makeNode({ parentId: parent.id });
      store.insertNode(parent);
      store.insertNode(child);

      const updated = store.updateNode(child.id, { parentId: null });
      expect(updated).toBeDefined();
      expect(updated!.parentId).toBeUndefined();
    });
  });

  // ── insertNode cycle protection ──

  describe("insertNode parentId validation", () => {
    it("should allow insertNode with valid parentId", () => {
      const parent = makeNode();
      store.insertNode(parent);

      const child = makeNode({ parentId: parent.id });
      store.insertNode(child);

      const retrieved = store.getNodeById(child.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.parentId).toBe(parent.id);
    });
  });
});
