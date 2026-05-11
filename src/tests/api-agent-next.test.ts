/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * §node_2458115e1079 — Task 1.3: GET /api/agents/next
 *
 * AC1: GIVEN run ativo WHEN GET THEN retorna próximas tasks não-bloqueadas após currentStep
 * AC2: GIVEN agente idle WHEN GET THEN retorna sugestão idle: true + próximas tasks
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { createAgentsRouter } from "../api/routes/agents.js";
import { generateId } from "../core/utils/id.js";

function makeTmpStore() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-next-test-"));
  const store = SqliteStore.open(tmpDir);
  store.initProject("test-project");
  return { store, tmpDir };
}

function makeApp(store: SqliteStore) {
  const storeRef = { current: store };
  const app = express();
  app.use(express.json());
  app.use("/agents", createAgentsRouter(storeRef));
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

function insertTask(store: SqliteStore, overrides: { title?: string; priority?: number; status?: string } = {}): string {
  const id = generateId("task");
  const doc = store.toGraphDocument();
  const projId = doc.project?.id ?? "default";
  store.getDb().prepare(`
    INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
    VALUES (?, ?, 'task', ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, projId, overrides.title ?? `Task ${id}`, overrides.status ?? "backlog", overrides.priority ?? 2);
  return id;
}

function insertActiveSession(store: SqliteStore, tasksCompleted: number = 0): void {
  store.getDb().prepare(`
    INSERT INTO autopilot_sessions (id, sprint_id, started_at, status, tasks_completed, tasks_failed, tokens_used, config, decisions)
    VALUES ('session-next', 'sprint-1', datetime('now'), 'running', ?, 0, 0, '{}', '[]')
  `).run(tasksCompleted);
}

let store: SqliteStore;
let tmpDir: string;

beforeEach(() => {
  ({ store, tmpDir } = makeTmpStore());
});

afterEach(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── AC1: active run — returns next unblocked tasks ────────────────────────────

describe("AC1: active run returns next unblocked steps", () => {
  it("returns idle:false when a session is running", async () => {
    insertActiveSession(store, 2);
    const res = await request(makeApp(store)).get("/agents/next");
    expect(res.status).toBe(200);
    expect(res.body.idle).toBe(false);
  });

  it("returns steps array (even empty) when session is running", async () => {
    insertActiveSession(store, 0);
    const res = await request(makeApp(store)).get("/agents/next");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.steps)).toBe(true);
  });

  it("returns up to 5 next tasks when backlog tasks exist", async () => {
    insertActiveSession(store, 3);
    for (let i = 0; i < 8; i++) {
      insertTask(store, { title: `Planned task ${i}`, priority: i + 1 });
    }
    const res = await request(makeApp(store)).get("/agents/next");
    expect(res.status).toBe(200);
    expect(res.body.steps.length).toBeLessThanOrEqual(5);
    expect(res.body.steps.length).toBeGreaterThan(0);
  });

  it("includes currentStep from tasks_completed when session is active", async () => {
    insertActiveSession(store, 7);
    const res = await request(makeApp(store)).get("/agents/next");
    expect(res.status).toBe(200);
    expect(res.body.currentStep).toBe(7);
  });

  it("each step has id and title fields", async () => {
    insertActiveSession(store, 0);
    insertTask(store, { title: "Next task" });
    const res = await request(makeApp(store)).get("/agents/next");
    expect(res.status).toBe(200);
    if (res.body.steps.length > 0) {
      expect(res.body.steps[0]).toHaveProperty("id");
      expect(res.body.steps[0]).toHaveProperty("title");
    }
  });
});

// ── AC2: idle — returns suggestion with idle:true ─────────────────────────────

describe("AC2: idle state returns suggestion", () => {
  it("returns idle:true when no active session", async () => {
    const res = await request(makeApp(store)).get("/agents/next");
    expect(res.status).toBe(200);
    expect(res.body.idle).toBe(true);
  });

  it("returns steps array for idle agent", async () => {
    insertTask(store, { title: "Suggested task" });
    const res = await request(makeApp(store)).get("/agents/next");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.steps)).toBe(true);
  });

  it("returns empty steps when no tasks exist", async () => {
    const res = await request(makeApp(store)).get("/agents/next");
    expect(res.status).toBe(200);
    expect(res.body.steps).toEqual([]);
  });
});
