/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §AgentMonitor — coverage for /api/v1/agents/:agentId/work + /diff.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("API /api/v1/agents/:agentId/work", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("returns 400 when agentId is empty in path", async () => {
    // express path matching means the route only fires with a non-empty
    // agentId; an empty segment yields 404 from express itself.
    const res = await request(ctx.app).get("/api/v1/agents//work");
    expect([400, 404]).toContain(res.status);
  });

  it("returns 404 when agent has no heartbeat row", async () => {
    const res = await request(ctx.app).get("/api/v1/agents/ghost/work");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("agent_not_found");
  });

  it("returns the work payload shape when the agent has a recent heartbeat", async () => {
    const db = ctx.store.getDb();
    const recentIso = new Date().toISOString();
    db.prepare(
      `INSERT INTO event_queue (event_type, payload, agent_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run("agent:heartbeat", JSON.stringify({}), "agent-A", recentIso);

    const res = await request(ctx.app).get("/api/v1/agents/agent-A/work");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      agent: expect.objectContaining({ agentId: "agent-A", status: "active" }),
      projectPhase: expect.any(String),
      currentTask: null,
      changedFileCount: expect.any(Number),
    });
    expect(Array.isArray(res.body.changedFiles)).toBe(true);
  });
});

describe("API /api/v1/agents/:agentId/events", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("returns an empty events array when the agent has no rows", async () => {
    const res = await request(ctx.app).get("/api/v1/agents/ghost/events");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      agentId: "ghost",
      events: [],
      limit: 30,
    });
  });

  it("clamps limit to 200 max", async () => {
    const res = await request(ctx.app).get(
      "/api/v1/agents/ghost/events?limit=999",
    );
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(200);
  });

  it("falls back to default 30 on invalid limit", async () => {
    const res = await request(ctx.app).get(
      "/api/v1/agents/ghost/events?limit=notanumber",
    );
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(30);
  });
});

describe("API /api/v1/agents/:agentId/diff", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("returns 400 when path is missing", async () => {
    const res = await request(ctx.app).get("/api/v1/agents/any/diff");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("path_required");
  });

  it("returns a diff payload shape with truncated flag", async () => {
    const res = await request(ctx.app).get(
      "/api/v1/agents/any/diff?path=does-not-exist.ts",
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("path", "does-not-exist.ts");
    expect(res.body).toHaveProperty("diff");
    expect(res.body).toHaveProperty("truncated");
    expect(typeof res.body.byteCount).toBe("number");
  });

  it("honors a custom baseRef param", async () => {
    const res = await request(ctx.app).get(
      "/api/v1/agents/any/diff?path=README.md&baseRef=HEAD~1",
    );
    expect(res.status).toBe(200);
    expect(res.body.baseRef).toBe("HEAD~1");
  });
});
