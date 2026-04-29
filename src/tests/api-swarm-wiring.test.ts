/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies (E19.T08).
 * Wiring contract: /swarm must be reachable through createApiRouter
 * (not just through standalone createSwarmRouter). Mirrors the e14-security
 * pattern used elsewhere in the project.
 */

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { createApiRouter } from "../api/router.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

function makeStore(): SqliteStore {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return {
    getDb: () => db,
    getProjectSetting: () => null,
    setProjectSetting: () => {},
  } as unknown as SqliteStore;
}

describe("/swarm wiring through createApiRouter (E19.T08)", () => {
  let app: express.Express;

  beforeEach(() => {
    const store = makeStore();
    app = express();
    app.use(express.json());
    app.use("/api", createApiRouter(store));
  });

  it("POST /api/swarm/sessions creates a session via central router", async () => {
    const res = await request(app).post("/api/swarm/sessions").send({
      topology: "ring",
      consensus: "majority",
      maxAgents: 2,
      strategy: "specialized",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "pending", topology: "ring" });
    expect(typeof res.body.id).toBe("string");
  });

  it("GET /api/swarm/sessions lists sessions via central router", async () => {
    await request(app).post("/api/swarm/sessions").send({
      topology: "hierarchical",
      consensus: "majority",
      maxAgents: 4,
      strategy: "specialized",
    });
    const res = await request(app).get("/api/swarm/sessions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBe(1);
  });

  it("GET /api/swarm/sessions/missing-id returns 404 via central router", async () => {
    const res = await request(app).get("/api/swarm/sessions/missing-id");
    expect(res.status).toBe(404);
  });
});
