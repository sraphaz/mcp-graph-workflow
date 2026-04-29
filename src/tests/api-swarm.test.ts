/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { createSwarmRouter } from "../api/routes/swarm.js";
import { errorHandler } from "../api/middleware/error-handler.js";
import type { StoreRef } from "../core/store/store-manager.js";

function makeStoreRef(): StoreRef {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  const stub = {
    getDb: () => db,
    getProjectSetting: () => null,
    setProjectSetting: () => {},
  } as unknown as import("../core/store/sqlite-store.js").SqliteStore;
  return { current: stub };
}

function makeApp(storeRef: StoreRef): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/swarm", createSwarmRouter(storeRef));
  app.use(errorHandler);
  return app;
}

const baseConfig = {
  topology: "ring",
  consensus: "majority",
  maxAgents: 2,
  strategy: "specialized",
};

describe("POST /swarm/sessions — shape contract", () => {
  let app: express.Express;

  beforeEach(() => {
    app = makeApp(makeStoreRef());
  });

  it("returns 201 with session id and pending status", async () => {
    const res = await request(app).post("/swarm/sessions").send(baseConfig);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "pending", topology: "ring" });
    expect(typeof res.body.id).toBe("string");
  });

  it("returns 400 for invalid topology", async () => {
    const res = await request(app).post("/swarm/sessions").send({ ...baseConfig, topology: "invalid" });
    expect(res.status).toBe(400);
  });
});

describe("GET /swarm/sessions", () => {
  let app: express.Express;

  beforeEach(() => {
    app = makeApp(makeStoreRef());
  });

  it("returns sessions array (empty initially)", async () => {
    const res = await request(app).get("/swarm/sessions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });

  it("lists created sessions", async () => {
    await request(app).post("/swarm/sessions").send(baseConfig);
    const res = await request(app).get("/swarm/sessions");
    expect(res.body.sessions).toHaveLength(1);
  });
});

describe("GET /swarm/sessions/:id", () => {
  let app: express.Express;

  beforeEach(() => {
    app = makeApp(makeStoreRef());
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app).get("/swarm/sessions/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns session for known id", async () => {
    const created = await request(app).post("/swarm/sessions").send(baseConfig);
    const res = await request(app).get(`/swarm/sessions/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });
});

describe("POST /swarm/sessions/:id/start + stop", () => {
  let app: express.Express;

  beforeEach(() => {
    app = makeApp(makeStoreRef());
  });

  it("start transitions to active", async () => {
    const created = await request(app).post("/swarm/sessions").send(baseConfig);
    const res = await request(app).post(`/swarm/sessions/${created.body.id}/start`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("active");
  });

  it("stop transitions to stopped", async () => {
    const created = await request(app).post("/swarm/sessions").send(baseConfig);
    await request(app).post(`/swarm/sessions/${created.body.id}/start`);
    const res = await request(app).post(`/swarm/sessions/${created.body.id}/stop`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("stopped");
  });

  it("start on unknown id returns 404", async () => {
    const res = await request(app).post("/swarm/sessions/bogus/start");
    expect(res.status).toBe(404);
  });
});

describe("POST /swarm/sessions/:id/scale", () => {
  let app: express.Express;

  beforeEach(() => {
    app = makeApp(makeStoreRef());
  });

  it("updates maxAgents", async () => {
    const created = await request(app).post("/swarm/sessions").send(baseConfig);
    const res = await request(app)
      .post(`/swarm/sessions/${created.body.id}/scale`)
      .send({ maxAgents: 8 });
    expect(res.status).toBe(200);
    expect(res.body.maxAgents).toBe(8);
  });

  it("rejects maxAgents > 32", async () => {
    const created = await request(app).post("/swarm/sessions").send(baseConfig);
    const res = await request(app)
      .post(`/swarm/sessions/${created.body.id}/scale`)
      .send({ maxAgents: 33 });
    expect(res.status).toBe(400);
  });
});

describe("GET /swarm/sessions/:id/health", () => {
  let app: express.Express;

  beforeEach(() => {
    app = makeApp(makeStoreRef());
  });

  it("returns healthy for active session", async () => {
    const created = await request(app).post("/swarm/sessions").send(baseConfig);
    await request(app).post(`/swarm/sessions/${created.body.id}/start`);
    const res = await request(app).get(`/swarm/sessions/${created.body.id}/health`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  it("returns 404 for unknown session", async () => {
    const res = await request(app).get("/swarm/sessions/nonexistent/health");
    expect(res.status).toBe(404);
  });
});
