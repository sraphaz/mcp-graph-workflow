/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.1: assembleSiblingContext helper (v11 Context-Pollination)
 * ADR-0047: topological sort + created_at tiebreak, fallback warning
 * ADR-0047: budget 4000 truncate-oldest-first
 * ADR-0047: markdown pré-renderizado no response
 */

import { describe, it, expect } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { SubtaskArtifactsStore } from "../../core/store/subtask-artifacts-store.js";
import { assembleSiblingContext } from "../../core/pipeline/assemble-sibling-context.js";

interface Harness {
  store: SqliteStore;
  artifacts: SubtaskArtifactsStore;
}

function setup(): Harness {
  const store = SqliteStore.open(":memory:");
  store.initProject("v11-assemble-test");
  return { store, artifacts: new SubtaskArtifactsStore(store) };
}

function mkNode(
  store: SqliteStore,
  id: string,
  parentId: string | null,
  title: string,
  createdAtOffsetMs = 0,
): void {
  const db = store.getDb();
  const projectRow = db.prepare("SELECT id FROM projects LIMIT 1").get() as {
    id: string;
  };
  const createdAt = new Date(Date.now() + createdAtOffsetMs).toISOString();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, parent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'done', 3, ?, ?, ?)`,
  ).run(
    id,
    projectRow.id,
    id.startsWith("epic") ? "epic" : "subtask",
    title,
    parentId,
    createdAt,
    createdAt,
  );
}

function mkEdge(
  store: SqliteStore,
  from: string,
  to: string,
  relationType = "depends_on",
): void {
  const db = store.getDb();
  const projectRow = db.prepare("SELECT id FROM projects LIMIT 1").get() as {
    id: string;
  };
  db.prepare(
    `INSERT INTO edges (id, project_id, from_node, to_node, relation_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    `edge_${from}_${to}`,
    projectRow.id,
    from,
    to,
    relationType,
    new Date().toISOString(),
  );
}

describe("AC1 — depends_on filtering (only ancestors included)", () => {
  it("GIVEN T3 depends on T1+T2, should include artifacts of T1/T2 only (not T4/T5)", () => {
    const { store, artifacts } = setup();

    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "t1", "epic1", "T1", 0);
    mkNode(store, "t2", "epic1", "T2", 100);
    mkNode(store, "t3", "epic1", "T3", 200);
    mkNode(store, "t4", "epic1", "T4", 300);
    mkNode(store, "t5", "epic1", "T5", 400);

    // T3 depends on T1 and T2
    mkEdge(store, "t3", "t1");
    mkEdge(store, "t3", "t2");

    for (const id of ["t1", "t2", "t3", "t4", "t5"]) {
      artifacts.insert({
        nodeId: id,
        epicId: "epic1",
        kind: "note",
        path: null,
        content: `content-${id}`,
      });
    }

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "t3",
    });

    const ids = result.siblings.map((s) => s.id).sort();
    expect(ids).toEqual(["t1", "t2"]);
  });

  it("should handle transitive dependencies (T3 → T2 → T1)", () => {
    const { store, artifacts } = setup();
    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "t1", "epic1", "T1", 0);
    mkNode(store, "t2", "epic1", "T2", 100);
    mkNode(store, "t3", "epic1", "T3", 200);
    mkEdge(store, "t3", "t2");
    mkEdge(store, "t2", "t1");

    for (const id of ["t1", "t2"]) {
      artifacts.insert({
        nodeId: id,
        epicId: "epic1",
        kind: "note",
        path: null,
        content: `c-${id}`,
      });
    }

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "t3",
    });

    const ids = result.siblings.map((s) => s.id).sort();
    expect(ids).toEqual(["t1", "t2"]);
  });

  it("should return empty siblings when subtask has no deps", () => {
    const { store } = setup();
    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "t1", "epic1", "T1");

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "t1",
    });

    expect(result.siblings).toEqual([]);
    expect(result.markdown).toBe("");
  });
});

describe("AC2 — Deterministic order (topological + created_at tiebreak)", () => {
  it("should order siblings topologically (T1 before T2 when T2 depends on T1)", () => {
    const { store, artifacts } = setup();
    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "t1", "epic1", "T1", 0);
    mkNode(store, "t2", "epic1", "T2", 100);
    mkNode(store, "t3", "epic1", "T3", 200);

    mkEdge(store, "t3", "t1");
    mkEdge(store, "t3", "t2");
    mkEdge(store, "t2", "t1");

    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "note",
      path: null,
      content: "first",
    });
    artifacts.insert({
      nodeId: "t2",
      epicId: "epic1",
      kind: "note",
      path: null,
      content: "second",
    });

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "t3",
    });

    expect(result.siblings.map((s) => s.id)).toEqual(["t1", "t2"]);
  });

  it("should use created_at tiebreak when deps parallel (no edge between T1/T2)", () => {
    const { store, artifacts } = setup();
    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "tA", "epic1", "tA", 0); // earlier
    mkNode(store, "tB", "epic1", "tB", 100); // later
    mkNode(store, "tC", "epic1", "tC", 200);

    mkEdge(store, "tC", "tA");
    mkEdge(store, "tC", "tB");

    artifacts.insert({
      nodeId: "tA",
      epicId: "epic1",
      kind: "note",
      path: null,
      content: "A",
    });
    artifacts.insert({
      nodeId: "tB",
      epicId: "epic1",
      kind: "note",
      path: null,
      content: "B",
    });

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "tC",
    });

    // earlier created → earlier in ordering when deps parallel
    expect(result.siblings.map((s) => s.id)).toEqual(["tA", "tB"]);
  });
});

describe("AC3 — Budget truncate-oldest-first", () => {
  it("should truncate oldest siblings when budget exceeded", () => {
    const { store, artifacts } = setup();
    mkNode(store, "epic1", null, "Epic");
    // Create 5 sibling ancestors with big content
    const bigContent = "x ".repeat(3000); // ~1500 tokens each
    for (let i = 0; i < 5; i++) {
      mkNode(store, `t${i}`, "epic1", `T${i}`, i * 100);
    }
    mkNode(store, "target", "epic1", "target", 1000);

    for (let i = 0; i < 5; i++) {
      mkEdge(store, "target", `t${i}`);
      artifacts.insert({
        nodeId: `t${i}`,
        epicId: "epic1",
        kind: "note",
        path: null,
        content: `${bigContent} unique-${i}`,
      });
    }

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "target",
      tokenBudget: 2000,
    });

    expect(result.truncatedCount).toBeGreaterThan(0);
    expect(result.totalTokens).toBeLessThanOrEqual(2000);
    // Siblings remaining should be the NEWEST (oldest truncated)
    const keptIds = result.siblings.map((s) => s.id);
    // t4 is newest in creation time — should be kept if any
    if (keptIds.length > 0) {
      expect(keptIds).toContain("t4");
    }
  });

  it("should respect default budget 4000 when unspecified", () => {
    const { store, artifacts } = setup();
    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "t1", "epic1", "T1", 0);
    mkNode(store, "target", "epic1", "target", 100);
    mkEdge(store, "target", "t1");
    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "note",
      path: null,
      content: "small",
    });

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "target",
    });

    expect(result.truncatedCount).toBe(0);
    expect(result.siblings).toHaveLength(1);
  });

  it("should return totalTokens field", () => {
    const { store, artifacts } = setup();
    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "t1", "epic1", "T1", 0);
    mkNode(store, "target", "epic1", "target", 100);
    mkEdge(store, "target", "t1");
    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "note",
      path: null,
      content: "hello world",
    });

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "target",
    });

    expect(typeof result.totalTokens).toBe("number");
    expect(result.totalTokens).toBeGreaterThan(0);
  });
});

describe("Markdown rendering (ADR-0047)", () => {
  it("should render markdown with ### Subtask header per sibling", () => {
    const { store, artifacts } = setup();
    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "t1", "epic1", "Setup module", 0);
    mkNode(store, "target", "epic1", "target", 100);
    mkEdge(store, "target", "t1");
    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "interface",
      path: "src/foo.ts",
      content: "export const x = 1;",
    });

    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "target",
    });

    expect(result.markdown).toContain("### Subtask");
    expect(result.markdown).toContain("Setup module");
    expect(result.markdown).toContain("export const x = 1;");
    expect(result.markdown).toContain("```");
  });

  it("should return empty string when no siblings", () => {
    const { store } = setup();
    mkNode(store, "epic1", null, "Epic");
    mkNode(store, "target", "epic1", "target", 0);
    const result = assembleSiblingContext(store, {
      epicId: "epic1",
      subtaskId: "target",
    });
    expect(result.markdown).toBe("");
  });
});
