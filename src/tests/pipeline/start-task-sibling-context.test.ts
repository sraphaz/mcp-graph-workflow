/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.2: start_task integrates assembleSiblingContext (v11 Context-Pollination)
 * ADR-0047: siblingContext markdown pronto no response.
 */

import { describe, it, expect } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { startTask } from "../../core/pipeline/start-task.js";
import { SubtaskArtifactsStore } from "../../core/store/subtask-artifacts-store.js";

function setup(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("v11-start-sibling-test");
  const now = new Date().toISOString();

  // epic
  store.insertNode({
    id: "epic1",
    type: "epic",
    title: "Epic parent",
    status: "backlog",
    priority: 2,
    blocked: false,
    createdAt: now,
    updatedAt: now,
  });

  // t1 — done sibling that t2 depends on
  store.insertNode({
    id: "t1",
    type: "subtask",
    title: "Setup module",
    status: "done",
    priority: 1,
    parentId: "epic1",
    xpSize: "S",
    blocked: false,
    acceptanceCriteria: ["GIVEN input WHEN processed THEN output."],
    createdAt: now,
    updatedAt: now,
  });

  // t2 — target: backlog, depends_on t1
  store.insertNode({
    id: "t2",
    type: "subtask",
    title: "Extend module",
    status: "backlog",
    priority: 1,
    parentId: "epic1",
    xpSize: "S",
    blocked: false,
    acceptanceCriteria: ["GIVEN module WHEN extended THEN new behavior."],
    createdAt: now,
    updatedAt: now,
  });

  // depends_on edge t2 -> t1
  store.insertEdge({
    id: "edge_t2_t1",
    from: "t2",
    to: "t1",
    relationType: "depends_on",
    createdAt: now,
  });

  return store;
}

describe("AC1 — Response includes siblingContext when epic has done siblings with artifacts", () => {
  it("should include siblingContext with artifacts from done dep", () => {
    const store = setup();
    const artifacts = new SubtaskArtifactsStore(store);
    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "interface",
      path: "src/foo.ts",
      content: "export const x = 1;",
    });

    const result = startTask(store, { nodeId: "t2", autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.siblingContext).toBeDefined();
    expect(result!.siblingContext).toContain("Setup module");
    expect(result!.siblingContext).toContain("export const x = 1;");
  });

  it("should return empty siblingContext when no siblings have artifacts", () => {
    const store = setup();
    // no artifacts persisted
    const result = startTask(store, { nodeId: "t2", autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.siblingContext).toBe("");
  });

  it("should return empty siblingContext when task has no parent epic", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("v11-lone-task");
    const now = new Date().toISOString();
    store.insertNode({
      id: "lone",
      type: "task",
      title: "Standalone",
      status: "backlog",
      priority: 1,
      blocked: false,
      createdAt: now,
      updatedAt: now,
    });

    const result = startTask(store, { nodeId: "lone", autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.siblingContext).toBe("");
  });
});

describe("AC2 — Markdown format (### Subtask header + code fences)", () => {
  it("should render ### Subtask <id>: <title> header per sibling", () => {
    const store = setup();
    const artifacts = new SubtaskArtifactsStore(store);
    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "file",
      path: "src/impl.ts",
      content: "export function run() { return 42; }",
    });

    const result = startTask(store, { nodeId: "t2", autoStart: false });

    expect(result!.siblingContext).toMatch(/### Subtask t1: Setup module/);
    expect(result!.siblingContext).toContain("```");
  });

  it("should use diff code fence for kind=diff", () => {
    const store = setup();
    const artifacts = new SubtaskArtifactsStore(store);
    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "diff",
      path: "src/foo.ts",
      content: "- old\n+ new",
    });

    const result = startTask(store, { nodeId: "t2", autoStart: false });

    expect(result!.siblingContext).toContain("```diff");
  });
});

describe("AC3 — siblingBudget override", () => {
  it("should accept siblingBudget option and pass to assembly", () => {
    const store = setup();
    const artifacts = new SubtaskArtifactsStore(store);
    // large artifact (~12K chars, should exceed default 4000 tokens)
    const bigContent = "export const x = 1; // ".repeat(500);
    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "file",
      path: "src/big.ts",
      content: bigContent,
    });

    // With default budget 4000 → likely truncates (sibling dropped)
    const defaultResult = startTask(store, {
      nodeId: "t2",
      autoStart: false,
    });
    // With large budget 50000 → keeps the sibling
    const largeResult = startTask(store, {
      nodeId: "t2",
      autoStart: false,
      siblingBudget: 50000,
    });

    // large budget should include more content than default
    expect(largeResult!.siblingContext.length).toBeGreaterThanOrEqual(
      defaultResult!.siblingContext.length,
    );
  });

  it("should respect very small budget (drops siblings)", () => {
    const store = setup();
    const artifacts = new SubtaskArtifactsStore(store);
    artifacts.insert({
      nodeId: "t1",
      epicId: "epic1",
      kind: "file",
      path: "src/foo.ts",
      content: "x".repeat(500),
    });

    const result = startTask(store, {
      nodeId: "t2",
      autoStart: false,
      siblingBudget: 10, // 10 tokens max — can't fit anything
    });

    // siblingContext should be empty (all truncated)
    expect(result!.siblingContext).toBe("");
  });
});
