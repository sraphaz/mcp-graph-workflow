/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1: Nova tabela subtask_artifacts (v11 Context-Pollination)
 * ADR-0046: tabela dedicada + indexes em (epic_id, created_at) e (node_id)
 * ADR-0048: canonicalization via ts-morph com fallback whitespace-strip
 */

import { describe, it, expect } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  SubtaskArtifactsStore,
  type ArtifactKind,
} from "../../core/store/subtask-artifacts-store.js";
import {
  canonicalizeTypeScript,
  computeContentHash,
} from "../../core/canonicalization/ts.js";

interface Harness {
  store: SqliteStore;
  artifacts: SubtaskArtifactsStore;
}

function openStore(): Harness {
  const store = SqliteStore.open(":memory:");
  store.initProject("v11-artifacts-test");
  return { store, artifacts: new SubtaskArtifactsStore(store) };
}

/** Create a minimal node (satisfies FK constraint) and return its id. */
function makeNode(
  store: SqliteStore,
  id: string,
  type: "epic" | "task" | "subtask" = "subtask",
): string {
  const db = store.getDb();
  const projectRow = db.prepare("SELECT id FROM projects LIMIT 1").get() as {
    id: string;
  };
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'backlog', 3, ?, ?)`,
  ).run(id, projectRow.id, type, `title-${id}`, now, now);
  return id;
}

describe("AC1 — Migration aplicavel e reversivel (up/down)", () => {
  it("should create subtask_artifacts table on migration run", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("v11-m-test");
    const db = store.getDb();

    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='subtask_artifacts'",
      )
      .get();

    expect(row).toBeTruthy();
  });

  it("should have all required columns", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("v11-cols-test");
    const db = store.getDb();

    const columns = db
      .prepare("PRAGMA table_info(subtask_artifacts)")
      .all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name).sort();

    expect(names).toEqual(
      [
        "id",
        "project_id",
        "node_id",
        "epic_id",
        "kind",
        "path",
        "content",
        "content_hash",
        "created_at",
      ].sort(),
    );
  });

  it("should enforce CHECK on kind enum", () => {
    const { store, artifacts } = openStore();
    makeNode(store, "node_test");
    expect(() =>
      artifacts.insert({
        nodeId: "node_test",
        epicId: "epic_test",
        kind: "invalid_kind" as ArtifactKind,
        path: null,
        content: "x",
      }),
    ).toThrow();
  });
});

describe("AC2 — Query by epic_id uses index (fast path)", () => {
  it("should have index on (epic_id, created_at)", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("v11-idx-test");
    const db = store.getDb();

    const indexes = db
      .prepare("PRAGMA index_list(subtask_artifacts)")
      .all() as Array<{ name: string }>;
    const hasEpicIndex = indexes.some((i) => i.name.includes("epic"));
    expect(hasEpicIndex).toBe(true);
  });

  it("should return ordered by created_at ASC", async () => {
    const { store, artifacts } = openStore();
    makeNode(store, "n1");
    makeNode(store, "n2");

    artifacts.insert({
      nodeId: "n1",
      epicId: "e1",
      kind: "note",
      path: null,
      content: "first",
    });
    // ensure distinct timestamps
    await new Promise((r) => setTimeout(r, 5));
    artifacts.insert({
      nodeId: "n2",
      epicId: "e1",
      kind: "note",
      path: null,
      content: "second",
    });

    const list = artifacts.listByEpic("e1");

    expect(list).toHaveLength(2);
    expect(list[0].content).toBe("first");
    expect(list[1].content).toBe("second");
    expect(list[0].createdAt <= list[1].createdAt).toBe(true);
  });

  it("should filter by epic_id (no cross-epic leak)", () => {
    const { store, artifacts } = openStore();
    makeNode(store, "n1");
    makeNode(store, "n2");

    artifacts.insert({
      nodeId: "n1",
      epicId: "e1",
      kind: "note",
      path: null,
      content: "a",
    });
    artifacts.insert({
      nodeId: "n2",
      epicId: "e2",
      kind: "note",
      path: null,
      content: "b",
    });

    const e1 = artifacts.listByEpic("e1");
    const e2 = artifacts.listByEpic("e2");

    expect(e1).toHaveLength(1);
    expect(e2).toHaveLength(1);
    expect(e1[0].content).toBe("a");
    expect(e2[0].content).toBe("b");
  });

  it("should return results in under 10ms for 50 artifacts in same epic", () => {
    const { store, artifacts } = openStore();
    for (let i = 0; i < 50; i++) {
      makeNode(store, `n${i}`);
      artifacts.insert({
        nodeId: `n${i}`,
        epicId: "epic_big",
        kind: "note",
        path: null,
        content: `content-${i}`,
      });
    }

    const start = performance.now();
    const list = artifacts.listByEpic("epic_big");
    const elapsed = performance.now() - start;

    expect(list).toHaveLength(50);
    expect(elapsed).toBeLessThan(10);
  });
});

describe("AC3 — Hash estavel entre re-runs (canonicalization)", () => {
  it("should produce identical hash for identical content", () => {
    const c = "export const x = 1;";
    expect(computeContentHash(c)).toBe(computeContentHash(c));
  });

  it("should produce identical hash ignoring trailing whitespace", () => {
    const a = "export const x = 1;";
    const b = "export const x = 1;   \n\n  ";
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it("should produce identical hash ignoring line comments (TS content)", () => {
    const a = "export const x = 1;";
    const b = "// trailing comment\nexport const x = 1;";
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it("should produce different hash for semantically different content", () => {
    const a = "export const x = 1;";
    const b = "export const y = 2;";
    expect(computeContentHash(a)).not.toBe(computeContentHash(b));
  });

  it("canonicalizeTypeScript strips comments and normalizes whitespace", () => {
    const input = "// comment\nexport const x = 1;\n\n\n";
    const out = canonicalizeTypeScript(input);
    expect(out).not.toContain("comment");
    expect(out.trim()).toBe(out);
  });

  it("canonicalizeTypeScript falls back gracefully on invalid TS", () => {
    const input = "this is \n\nnot typescript at all {{{";
    const out = canonicalizeTypeScript(input);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("AC4 — Schema cobre todos os kinds", () => {
  const validKinds: ArtifactKind[] = [
    "diff",
    "file",
    "interface",
    "decision",
    "note",
  ];

  for (const kind of validKinds) {
    it(`should accept kind="${kind}"`, () => {
      const { store, artifacts } = openStore();
      makeNode(store, `n_k_${kind}`);
      const id = artifacts.insert({
        nodeId: `n_k_${kind}`,
        epicId: "e_k",
        kind,
        path: kind === "file" ? "src/foo.ts" : null,
        content: `content-${kind}`,
      });
      expect(id).toBeTruthy();
    });
  }
});

describe("Dedup by (epic_id, kind, content_hash)", () => {
  it("should return existing artifact id on dup insert", () => {
    const { store, artifacts } = openStore();
    makeNode(store, "n1");
    makeNode(store, "n2");

    const id1 = artifacts.insert({
      nodeId: "n1",
      epicId: "e1",
      kind: "interface",
      path: null,
      content: "export const x = 1;",
    });
    const id2 = artifacts.insert({
      nodeId: "n2",
      epicId: "e1",
      kind: "interface",
      path: null,
      content: "export const x = 1;",
    });

    expect(id1).toBe(id2);
    expect(artifacts.listByEpic("e1")).toHaveLength(1);
  });

  it("should NOT dedup across kinds", () => {
    const { store, artifacts } = openStore();
    makeNode(store, "n1");
    makeNode(store, "n2");

    artifacts.insert({
      nodeId: "n1",
      epicId: "e1",
      kind: "interface",
      path: null,
      content: "export const x = 1;",
    });
    artifacts.insert({
      nodeId: "n2",
      epicId: "e1",
      kind: "note",
      path: null,
      content: "export const x = 1;",
    });

    expect(artifacts.listByEpic("e1")).toHaveLength(2);
  });

  it("should NOT dedup across epics", () => {
    const { store, artifacts } = openStore();
    makeNode(store, "n1");
    makeNode(store, "n2");

    artifacts.insert({
      nodeId: "n1",
      epicId: "e1",
      kind: "note",
      path: null,
      content: "same",
    });
    artifacts.insert({
      nodeId: "n2",
      epicId: "e2",
      kind: "note",
      path: null,
      content: "same",
    });

    expect(artifacts.listByEpic("e1")).toHaveLength(1);
    expect(artifacts.listByEpic("e2")).toHaveLength(1);
  });
});

describe("listByNode", () => {
  it("should return artifacts for a single node", () => {
    const { store, artifacts } = openStore();
    makeNode(store, "n1");
    makeNode(store, "n2");

    artifacts.insert({
      nodeId: "n1",
      epicId: "e1",
      kind: "note",
      path: null,
      content: "a",
    });
    artifacts.insert({
      nodeId: "n1",
      epicId: "e1",
      kind: "decision",
      path: null,
      content: "b",
    });
    artifacts.insert({
      nodeId: "n2",
      epicId: "e1",
      kind: "note",
      path: null,
      content: "c",
    });

    const n1 = artifacts.listByNode("n1");
    expect(n1).toHaveLength(2);
  });
});
