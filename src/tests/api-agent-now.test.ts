/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Endpoint GET /api/agents/now
 *
 * AC1: agente idle → {phase, activeSession: null, idle: true}
 * AC2: agente em run → {phase, activeRun: {runId, currentStep}, currentTool: {...}}
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { createAgentsRouter } from "../api/routes/agents.js";

function makeTmpStore() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-now-test-"));
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
    res.status(500).json({ error: err.message, stack: err.stack?.split("\n")[1] });
  });
  return app;
}

describe("GET /agents/now — AC1: idle state", () => {
  let store: SqliteStore;
  let tmpDir: string;

  beforeEach(() => {
    ({ store, tmpDir } = makeTmpStore());
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return idle:true and activeSession:null when no session running", async () => {
    const app = makeApp(store);
    const res = await request(app).get("/agents/now");
    expect(res.status).toBe(200);
    expect(res.body.idle).toBe(true);
    expect(res.body.activeSession).toBeNull();
  });

  it("should include phase in response", async () => {
    const app = makeApp(store);
    const res = await request(app).get("/agents/now");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("phase");
    expect(typeof res.body.phase).toBe("string");
  });
});

describe("GET /agents/now — AC2: active run state", () => {
  let store: SqliteStore;
  let tmpDir: string;

  beforeEach(() => {
    ({ store, tmpDir } = makeTmpStore());
    const db = store.getDb();
    db.prepare(`
      INSERT INTO autopilot_sessions (id, sprint_id, started_at, status, tasks_completed, tasks_failed, tokens_used, config, decisions)
      VALUES ('run-abc', 'sprint-1', '2026-05-09T00:00:00Z', 'running', 2, 0, 1000, '{}', '[]')
    `).run();
    const projRow = db.prepare<[], { id: string }>(`SELECT id FROM projects LIMIT 1`).get();
    const projId = projRow?.id ?? "default";
    if (!projRow) {
      db.prepare(`INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, 'test', datetime('now'), datetime('now'))`).run(projId);
    }
    db.prepare(`
      INSERT INTO tool_token_usage (project_id, tool_name, input_tokens, output_tokens, called_at, success, duration_ms, error_kind)
      VALUES (?, 'start_task', 100, 50, datetime('now'), 1, 250, NULL)
    `).run(projId);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return activeRun with runId when session is running", async () => {
    const app = makeApp(store);
    const res = await request(app).get("/agents/now");
    expect(res.status).toBe(200);
    expect(res.body.idle).toBe(false);
    expect(res.body.activeRun).not.toBeNull();
    expect(res.body.activeRun.runId).toBe("run-abc");
  });

  it("should include currentTool from most recent tool_token_usage", async () => {
    const app = makeApp(store);
    const res = await request(app).get("/agents/now");
    expect(res.status).toBe(200);
    expect(res.body.currentTool).not.toBeNull();
    expect(res.body.currentTool.name).toBe("start_task");
  });

  it("should include currentStep from tasks_completed", async () => {
    const app = makeApp(store);
    const res = await request(app).get("/agents/now");
    expect(res.status).toBe(200);
    expect(res.body.activeRun.currentStep).toBe(2);
  });
});
