/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2: finish_task aceita artifacts payload (v11 Context-Pollination)
 * ADR-0049: parametro artifacts opcional + artifactIds no response.
 */

import { describe, it, expect } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { finishTask } from "../../core/pipeline/finish-task.js";
import { SubtaskArtifactsStore } from "../../core/store/subtask-artifacts-store.js";

interface Harness {
  store: SqliteStore;
  epicId: string;
  subtaskId: string;
}

function setup(): Harness {
  const store = SqliteStore.open(":memory:");
  store.initProject("v11-finish-artifacts");
  const now = new Date().toISOString();

  store.insertNode({
    id: "epic_v11",
    type: "epic",
    title: "Epic parent",
    status: "backlog",
    priority: 2,
    blocked: false,
    createdAt: now,
    updatedAt: now,
  });

  store.insertNode({
    id: "sub_v11_1",
    type: "subtask",
    title: "Subtask 1",
    status: "in_progress",
    priority: 1,
    parentId: "epic_v11",
    description: "Implements feature X",
    xpSize: "S",
    blocked: false,
    acceptanceCriteria: [
      "GIVEN feature WHEN triggered THEN result produced.",
      "GIVEN invalid input WHEN triggered THEN graceful error.",
    ],
    createdAt: now,
    updatedAt: now,
  });

  return { store, epicId: "epic_v11", subtaskId: "sub_v11_1" };
}

describe("AC2 — Backward compatibility (no artifacts)", () => {
  it("should return artifactIds=[] when artifacts not passed", async () => {
    const { store, subtaskId } = setup();

    const result = await finishTask(store, subtaskId, {
      rationale: "test v10-style call",
      autoNext: false,
    });

    expect(result.status).toBe("done");
    expect(result.artifactIds).toEqual([]);
  });

  it("should keep existing fields unchanged when artifacts omitted", async () => {
    const { store, subtaskId } = setup();

    const result = await finishTask(store, subtaskId, { autoNext: false });

    expect(result.dodReport).toBeDefined();
    expect(result.status).toBe("done");
    expect(typeof result.decisionIndexed).toBe("boolean");
  });
});

describe("AC1 — Persist artifacts on finish", () => {
  it("should persist each artifact and return matching artifactIds", async () => {
    const { store, epicId, subtaskId } = setup();

    const result = await finishTask(store, subtaskId, {
      autoNext: false,
      artifacts: [
        {
          kind: "interface",
          path: "src/types.ts",
          content: "export type Foo = { bar: number };",
        },
        {
          kind: "file",
          path: "src/impl.ts",
          content: "export const run = () => 42;",
        },
      ],
    });

    expect(result.artifactIds).toHaveLength(2);
    expect(result.artifactIds.every((id) => typeof id === "string")).toBe(true);

    const artifacts = new SubtaskArtifactsStore(store);
    const stored = artifacts.listByEpic(epicId);
    expect(stored).toHaveLength(2);

    const kinds = stored.map((a) => a.kind).sort();
    expect(kinds).toEqual(["file", "interface"]);

    const paths = stored.map((a) => a.path).filter(Boolean);
    expect(paths).toContain("src/types.ts");
    expect(paths).toContain("src/impl.ts");
  });

  it("should accept artifacts with null/undefined path", async () => {
    const { store, subtaskId } = setup();

    const result = await finishTask(store, subtaskId, {
      autoNext: false,
      artifacts: [
        { kind: "note", content: "A note without path" },
        { kind: "decision", path: null, content: "A decision" },
      ],
    });

    expect(result.artifactIds).toHaveLength(2);
  });

  it("should associate artifact with the finishing node (listByNode returns them)", async () => {
    const { store, subtaskId } = setup();

    await finishTask(store, subtaskId, {
      autoNext: false,
      artifacts: [
        { kind: "note", content: "for this node" },
      ],
    });

    const artifacts = new SubtaskArtifactsStore(store);
    const forNode = artifacts.listByNode(subtaskId);
    expect(forNode).toHaveLength(1);
    expect(forNode[0].content).toBe("for this node");
  });
});

describe("AC3 — Dedup by content_hash", () => {
  it("should return existing id when artifact dup (same epic, same kind, same content)", async () => {
    const { store, epicId, subtaskId } = setup();

    // First finish with an artifact
    const result1 = await finishTask(store, subtaskId, {
      autoNext: false,
      artifacts: [
        { kind: "interface", path: "a.ts", content: "export const x = 1;" },
      ],
    });
    expect(result1.artifactIds).toHaveLength(1);

    // Add a second subtask and finish with SAME content same kind same epic
    const now2 = new Date().toISOString();
    store.insertNode({
      id: "sub_v11_2",
      type: "subtask",
      title: "Subtask 2",
      status: "in_progress",
      priority: 1,
      parentId: "epic_v11",
      description: "Extends feature X",
      xpSize: "S",
      blocked: false,
      acceptanceCriteria: [
        "GIVEN extension WHEN triggered THEN result produced.",
      ],
      createdAt: now2,
      updatedAt: now2,
    });

    const result2 = await finishTask(store, "sub_v11_2", {
      autoNext: false,
      artifacts: [
        { kind: "interface", path: "a.ts", content: "export const x = 1;" },
      ],
    });

    expect(result2.artifactIds).toHaveLength(1);
    expect(result2.artifactIds[0]).toBe(result1.artifactIds[0]);

    const artifacts = new SubtaskArtifactsStore(store);
    expect(artifacts.listByEpic(epicId)).toHaveLength(1);
  });
});
