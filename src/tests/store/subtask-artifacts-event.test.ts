/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.3: Event subtask_artifact:created (v11 Context-Pollination)
 * Emit via GraphEventBus when artifact is persisted (not on dedup hit).
 */

import { describe, it, expect } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { SubtaskArtifactsStore } from "../../core/store/subtask-artifacts-store.js";
import { GraphEventBus } from "../../core/events/event-bus.js";
import type { GraphEvent } from "../../core/events/event-types.js";

function setupWithBus(): {
  store: SqliteStore;
  artifacts: SubtaskArtifactsStore;
  bus: GraphEventBus;
  captured: GraphEvent[];
} {
  const store = SqliteStore.open(":memory:");
  store.initProject("v11-event-test");
  const bus = new GraphEventBus();
  store.eventBus = bus;

  const db = store.getDb();
  const projectRow = db.prepare("SELECT id FROM projects LIMIT 1").get() as {
    id: string;
  };
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
     VALUES (?, ?, 'subtask', ?, 'backlog', 3, ?, ?)`,
  ).run("n_evt", projectRow.id, "n_evt title", now, now);

  const captured: GraphEvent[] = [];
  bus.on("subtask_artifact:created", (evt) => captured.push(evt));

  return { store, artifacts: new SubtaskArtifactsStore(store), bus, captured };
}

describe("AC1 — Event emission on persist", () => {
  it("should emit subtask_artifact:created when a new artifact is inserted", () => {
    const { artifacts, captured } = setupWithBus();

    artifacts.insert({
      nodeId: "n_evt",
      epicId: "e_evt",
      kind: "note",
      path: null,
      content: "hello",
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("subtask_artifact:created");
  });
});

describe("AC2 — Event payload shape", () => {
  it("should include artifactId, nodeId, epicId, kind, contentHash", () => {
    const { artifacts, captured } = setupWithBus();

    const id = artifacts.insert({
      nodeId: "n_evt",
      epicId: "e_evt",
      kind: "interface",
      path: "src/foo.ts",
      content: "export const x = 1;",
    });

    expect(captured).toHaveLength(1);
    const payload = captured[0].payload as Record<string, unknown>;
    expect(payload.artifactId).toBe(id);
    expect(payload.nodeId).toBe("n_evt");
    expect(payload.epicId).toBe("e_evt");
    expect(payload.kind).toBe("interface");
    expect(typeof payload.contentHash).toBe("string");
    expect((payload.contentHash as string).length).toBe(64); // sha256 hex
  });

  it("should include ISO8601 timestamp", () => {
    const { artifacts, captured } = setupWithBus();
    artifacts.insert({
      nodeId: "n_evt",
      epicId: "e_evt",
      kind: "note",
      path: null,
      content: "x",
    });

    expect(captured[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("AC3 — Listener inscribes without modifying finishTask", () => {
  it("should allow multiple listeners to receive same event", () => {
    const { artifacts, bus } = setupWithBus();
    const listenerA: GraphEvent[] = [];
    const listenerB: GraphEvent[] = [];

    bus.on("subtask_artifact:created", (e) => listenerA.push(e));
    bus.on("subtask_artifact:created", (e) => listenerB.push(e));

    artifacts.insert({
      nodeId: "n_evt",
      epicId: "e_evt",
      kind: "note",
      path: null,
      content: "multi",
    });

    expect(listenerA).toHaveLength(1);
    expect(listenerB).toHaveLength(1);
  });

  it("should NOT emit when dedup hit returns existing id", () => {
    const { artifacts, captured } = setupWithBus();

    const id1 = artifacts.insert({
      nodeId: "n_evt",
      epicId: "e_evt",
      kind: "interface",
      path: null,
      content: "export const x = 1;",
    });
    // Same content, same kind, same epic — should dedup, no new event
    const id2 = artifacts.insert({
      nodeId: "n_evt",
      epicId: "e_evt",
      kind: "interface",
      path: null,
      content: "export const x = 1;",
    });

    expect(id1).toBe(id2);
    expect(captured).toHaveLength(1);
  });

  it("should not crash insert if no eventBus attached", () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("v11-no-bus");
    const db = store.getDb();
    const projectRow = db.prepare("SELECT id FROM projects LIMIT 1").get() as {
      id: string;
    };
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
       VALUES (?, ?, 'subtask', 't', 'backlog', 3, ?, ?)`,
    ).run("n_nobus", projectRow.id, now, now);

    const artifacts = new SubtaskArtifactsStore(store);
    expect(() =>
      artifacts.insert({
        nodeId: "n_nobus",
        epicId: "e_nobus",
        kind: "note",
        path: null,
        content: "no bus",
      }),
    ).not.toThrow();
  });
});
