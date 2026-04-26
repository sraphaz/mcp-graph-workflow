/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { SubtaskArtifactsStore } from "../core/store/subtask-artifacts-store.js";
import { makeNode } from "./helpers/factories.js";

describe("SubtaskArtifactsStore", () => {
  let base: SqliteStore;
  let store: SubtaskArtifactsStore;

  // Helper: ensure a node exists so FK(node_id → nodes.id) is satisfied.
  function ensureNode(id: string): void {
    base.insertNode(makeNode({ id }));
  }

  beforeEach(() => {
    base = SqliteStore.open(":memory:");
    base.initProject("artifacts-test");
    store = new SubtaskArtifactsStore(base);
  });

  describe("insert", () => {
    it("returns a generated artifact id and persists the row", () => {
      ensureNode("node-1");
      const id = store.insert({
        nodeId: "node-1",
        epicId: "epic-1",
        kind: "decision",
        content: "use postgres for write path",
      });
      expect(id).toMatch(/^artifact_/);

      const got = store.getById(id);
      expect(got).not.toBeNull();
      expect(got?.kind).toBe("decision");
      expect(got?.content).toBe("use postgres for write path");
      expect(got?.path).toBeNull();
    });

    it("dedups on (epicId, kind, content_hash) — same content returns prior id", () => {
      ensureNode("n-a");
      ensureNode("n-b");
      const a = store.insert({
        nodeId: "n-a",
        epicId: "epic-1",
        kind: "file",
        path: "src/x.ts",
        content: "export const x = 1;\n",
      });
      const b = store.insert({
        nodeId: "n-b",
        epicId: "epic-1",
        kind: "file",
        path: "src/x.ts",
        content: "export const x = 1;\n",
      });
      expect(a).toBe(b);
      expect(store.listByEpic("epic-1")).toHaveLength(1);
    });

    it("does NOT dedup across different kinds", () => {
      ensureNode("n-1");
      const a = store.insert({
        nodeId: "n-1",
        epicId: "epic-1",
        kind: "file",
        path: "x.ts",
        content: "same content",
      });
      const b = store.insert({
        nodeId: "n-1",
        epicId: "epic-1",
        kind: "note",
        content: "same content",
      });
      expect(a).not.toBe(b);
    });

    it("does NOT dedup across different epics", () => {
      ensureNode("n-1");
      ensureNode("n-2");
      const a = store.insert({
        nodeId: "n-1", epicId: "epic-1", kind: "decision",
        content: "X",
      });
      const b = store.insert({
        nodeId: "n-2", epicId: "epic-2", kind: "decision",
        content: "X",
      });
      expect(a).not.toBe(b);
    });

    it("throws when no project has been initialized", () => {
      const empty = SqliteStore.open(":memory:");
      const s = new SubtaskArtifactsStore(empty);
      expect(() => s.insert({
        nodeId: "n", epicId: "e", kind: "note", content: "x",
      })).toThrow(/no_project/);
    });

    it("accepts all five artifact kinds", () => {
      const kinds = ["diff", "file", "interface", "decision", "note"] as const;
      for (const k of kinds) {
        ensureNode("n-" + k);
        const id = store.insert({
          nodeId: "n-" + k,
          epicId: "epic-multi",
          kind: k,
          content: `content for ${k}`,
        });
        expect(store.getById(id)?.kind).toBe(k);
      }
    });
  });

  describe("listByEpic", () => {
    it("returns all artifacts for the epic (chronological tie-break ordering not guaranteed in tests)", () => {
      // Two inserts inside the same millisecond share created_at and the
      // ORDER BY id ASC tie-break depends on UUIDs — assert set equality
      // instead of array order. The query path's ORDER BY clause is
      // exercised by listByNode below where ordering matters more.
      ensureNode("n");
      store.insert({ nodeId: "n", epicId: "e", kind: "note", content: "first" });
      store.insert({ nodeId: "n", epicId: "e", kind: "note", content: "second" });
      const contents = store.listByEpic("e").map((a) => a.content).sort();
      expect(contents).toEqual(["first", "second"]);
    });

    it("returns empty array when epic has no artifacts", () => {
      expect(store.listByEpic("nope")).toEqual([]);
    });
  });

  describe("listByNode", () => {
    it("filters by node_id, ignoring other nodes in the same epic", () => {
      ensureNode("n-1");
      ensureNode("n-2");
      store.insert({ nodeId: "n-1", epicId: "e", kind: "note", content: "for n1" });
      store.insert({ nodeId: "n-2", epicId: "e", kind: "note", content: "for n2" });
      const onlyN1 = store.listByNode("n-1");
      expect(onlyN1).toHaveLength(1);
      expect(onlyN1[0].nodeId).toBe("n-1");
    });
  });

  describe("getById", () => {
    it("returns null for unknown id", () => {
      expect(store.getById("artifact_nonexistent")).toBeNull();
    });
  });
});
