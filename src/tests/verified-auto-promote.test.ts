/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Tests for verified-auto-promote: cross-checks sourceRef + testFiles + tests
 * before promoting parent epic to done. Closes the drift gap where node
 * status="done" was being assumed without verification.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { verifyAndPromote, type VerifyOptions } from "../core/utils/verified-auto-promote.js";

interface NodeSeed {
  id: string;
  type: "epic" | "task" | "subtask";
  title: string;
  status: "backlog" | "in_progress" | "done";
  parentId?: string | null;
  sourceFile?: string;
  testFiles?: string[];
}

function makeStore(): SqliteStore {
  const store = SqliteStore.openDb(":memory:");
  store.initProject("test");
  return store;
}

function seed(store: SqliteStore, nodes: NodeSeed[]): void {
  const now = new Date().toISOString();
  for (const n of nodes) {
    store.insertNode({
      id: n.id,
      type: n.type,
      title: n.title,
      status: n.status,
      priority: 3,
      parentId: n.parentId ?? null,
      createdAt: now,
      updatedAt: now,
      ...(n.sourceFile
        ? { sourceRef: { file: n.sourceFile, startLine: 1, endLine: 1, confidence: 1 } }
        : {}),
      ...(n.testFiles ? { testFiles: n.testFiles } : {}),
    });
  }
}

describe("verifyAndPromote (E?.T? — verified auto-promote)", () => {
  let store: SqliteStore;
  let tmpDir: string;

  beforeEach(() => {
    store = makeStore();
    tmpDir = mkdtempSync(path.join(tmpdir(), "verified-promote-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function fileIn(rel: string): string {
    const p = path.join(tmpDir, rel);
    writeFileSync(p, "// dummy", "utf-8");
    return p;
  }

  function withTestRunner(passing: boolean): VerifyOptions {
    return {
      runTestGate: async () => ({
        status: passing ? "passed" : "failed",
        blocked: !passing,
        passed: passing ? 1 : 0,
        failed: passing ? 0 : 1,
        errors: [],
        durationMs: 1,
        testFiles: ["x"],
        mode: "strict",
      }),
    };
  }

  it("returns {promoted:[], rejected:[]} when triggering node has no parent", async () => {
    seed(store, [{ id: "root", type: "epic", title: "Root", status: "done" }]);
    const r = await verifyAndPromote(store, "root", withTestRunner(true));
    expect(r.promoted).toEqual([]);
    expect(r.rejected).toEqual([]);
  });

  it("returns no promote when sibling is still in_progress", async () => {
    seed(store, [
      { id: "epic", type: "epic", title: "E", status: "backlog" },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "epic" },
      { id: "s2", type: "subtask", title: "S2", status: "in_progress", parentId: "epic" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(true));
    expect(r.promoted).toEqual([]);
    expect(r.rejected).toEqual([]);
  });

  it("promotes parent when all children done + sourceRef exists + testFiles exist + tests green", async () => {
    const src = fileIn("src.ts");
    const test = fileIn("src.test.ts");
    seed(store, [
      {
        id: "epic",
        type: "epic",
        title: "E",
        status: "backlog",
        sourceFile: src,
        testFiles: [test],
      },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "epic" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(true));
    expect(r.promoted).toContain("epic");
    expect(r.rejected).toEqual([]);
    expect(store.getNodeById("epic")?.status).toBe("done");
  });

  it("rejects with reason 'sourceRef file missing' when sourceRef.file does not exist on disk", async () => {
    seed(store, [
      {
        id: "epic",
        type: "epic",
        title: "E",
        status: "backlog",
        sourceFile: path.join(tmpDir, "ghost.ts"),
      },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "epic" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(true));
    expect(r.promoted).toEqual([]);
    expect(r.rejected.length).toBe(1);
    expect(r.rejected[0]?.reasons.some((rr) => rr.includes("sourceRef"))).toBe(true);
    expect(store.getNodeById("epic")?.status).toBe("backlog");
  });

  it("rejects with reason 'testFile missing' when listed testFile not on disk", async () => {
    const src = fileIn("src.ts");
    seed(store, [
      {
        id: "epic",
        type: "epic",
        title: "E",
        status: "backlog",
        sourceFile: src,
        testFiles: [path.join(tmpDir, "ghost.test.ts")],
      },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "epic" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(true));
    expect(r.promoted).toEqual([]);
    expect(r.rejected[0]?.reasons.some((rr) => rr.includes("testFile"))).toBe(true);
  });

  it("rejects with reason 'tests failed' when runTestGate returns failed > 0", async () => {
    const src = fileIn("src.ts");
    const test = fileIn("src.test.ts");
    seed(store, [
      {
        id: "epic",
        type: "epic",
        title: "E",
        status: "backlog",
        sourceFile: src,
        testFiles: [test],
      },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "epic" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(false));
    expect(r.promoted).toEqual([]);
    expect(r.rejected[0]?.reasons.some((rr) => rr.includes("tests"))).toBe(true);
  });

  it("walks chain: subtask → task → epic, promotes both when all green", async () => {
    const src = fileIn("a.ts");
    const test = fileIn("a.test.ts");
    seed(store, [
      {
        id: "epic",
        type: "epic",
        title: "E",
        status: "backlog",
        sourceFile: src,
        testFiles: [test],
      },
      {
        id: "task",
        type: "task",
        title: "T",
        status: "backlog",
        parentId: "epic",
        sourceFile: src,
        testFiles: [test],
      },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "task" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(true));
    expect(r.promoted).toEqual(expect.arrayContaining(["task", "epic"]));
    expect(store.getNodeById("task")?.status).toBe("done");
    expect(store.getNodeById("epic")?.status).toBe("done");
  });

  it("interrompe cadeia ascendente quando pai intermediário falha verificação", async () => {
    const src = fileIn("a.ts");
    const test = fileIn("a.test.ts");
    seed(store, [
      {
        id: "epic",
        type: "epic",
        title: "E",
        status: "backlog",
        sourceFile: src,
        testFiles: [test],
      },
      {
        id: "task",
        type: "task",
        title: "T",
        status: "backlog",
        parentId: "epic",
        // Intermediate FAILS: testFile path missing on disk
        sourceFile: src,
        testFiles: [path.join(tmpDir, "ghost.test.ts")],
      },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "task" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(true));
    expect(r.promoted).not.toContain("task");
    expect(r.promoted).not.toContain("epic");
    expect(r.rejected.some((x) => x.nodeId === "task")).toBe(true);
    expect(store.getNodeById("epic")?.status).toBe("backlog");
  });

  it("no-op (sem promote) quando pai já é status=done", async () => {
    seed(store, [
      { id: "epic", type: "epic", title: "E", status: "done" },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "epic" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(true));
    expect(r.promoted).toEqual([]);
  });

  it("skips sourceRef check when node has no sourceRef.file (lenient)", async () => {
    const test = fileIn("a.test.ts");
    seed(store, [
      {
        id: "epic",
        type: "epic",
        title: "E",
        status: "backlog",
        testFiles: [test],
      },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "epic" },
    ]);
    const r = await verifyAndPromote(store, "s1", withTestRunner(true));
    expect(r.promoted).toContain("epic");
  });

  it("skips runTestGate when node has no testFiles (lenient when sourceRef ok)", async () => {
    const src = fileIn("src.ts");
    let called = 0;
    const opts: VerifyOptions = {
      runTestGate: async () => {
        called++;
        return {
          status: "skipped",
          blocked: false,
          passed: 0,
          failed: 0,
          errors: [],
          durationMs: 0,
          testFiles: [],
          mode: "strict",
        };
      },
    };
    seed(store, [
      {
        id: "epic",
        type: "epic",
        title: "E",
        status: "backlog",
        sourceFile: src,
      },
      { id: "s1", type: "subtask", title: "S1", status: "done", parentId: "epic" },
    ]);
    const r = await verifyAndPromote(store, "s1", opts);
    expect(r.promoted).toContain("epic");
    expect(called).toBe(0); // no testFiles → runTestGate not called
  });
});
