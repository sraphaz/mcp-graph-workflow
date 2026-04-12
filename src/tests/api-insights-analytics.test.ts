/**
 * Integration tests for new analytics API routes:
 * - GET /api/v1/insights/dora
 * - GET /api/v1/insights/cfd
 * - GET /api/v1/insights/sprint-health
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode, makeDoneTask, makeBlockedTask } from "./helpers/factories.js";

describe("API /api/v1/insights — analytics endpoints", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/insights/dora", () => {
    it("should return DORA metrics with all 4 indicators", async () => {
      const res = await request(ctx.app).get("/api/v1/insights/dora");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("deploymentFrequency");
      expect(res.body).toHaveProperty("leadTime");
      expect(res.body.leadTime).toHaveProperty("p50");
      expect(res.body.leadTime).toHaveProperty("p85");
      expect(res.body.leadTime).toHaveProperty("p95");
      expect(res.body).toHaveProperty("changeFailureRate");
      expect(res.body).toHaveProperty("mttr");
      expect(res.body).toHaveProperty("trend");
      expect(["improving", "stable", "declining"]).toContain(res.body.trend);
    });

    it("should return zeros for empty project", async () => {
      const res = await request(ctx.app).get("/api/v1/insights/dora");

      expect(res.status).toBe(200);
      expect(res.body.deploymentFrequency).toBe(0);
      expect(res.body.trend).toBe("stable");
    });

    it("should calculate non-zero frequency with done tasks", async () => {
      // Insert a few recently-done tasks
      ctx.store.insertNode(makeDoneTask());
      ctx.store.insertNode(makeDoneTask());
      ctx.store.insertNode(makeDoneTask());

      const res = await request(ctx.app).get("/api/v1/insights/dora");

      expect(res.status).toBe(200);
      expect(res.body.deploymentFrequency).toBeGreaterThan(0);
    });
  });

  describe("GET /api/v1/insights/cfd", () => {
    it("should return array of flow snapshots", async () => {
      const res = await request(ctx.app).get("/api/v1/insights/cfd");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("should capture today's snapshot and return it", async () => {
      // Add some nodes so snapshot has data
      ctx.store.insertNode(makeNode({ status: "backlog" }));
      ctx.store.insertNode(makeNode({ status: "in_progress" }));
      ctx.store.insertNode(makeDoneTask());

      const res = await request(ctx.app).get("/api/v1/insights/cfd");

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const snapshot = res.body[0];
      expect(snapshot).toHaveProperty("snapshotDate");
      expect(snapshot).toHaveProperty("backlogCount");
      expect(snapshot).toHaveProperty("readyCount");
      expect(snapshot).toHaveProperty("inProgressCount");
      expect(snapshot).toHaveProperty("blockedCount");
      expect(snapshot).toHaveProperty("doneCount");
    });

    it("should accept optional sprint filter", async () => {
      const res = await request(ctx.app).get("/api/v1/insights/cfd?sprint=S1");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/v1/insights/sprint-health", () => {
    it("should return health report with grade", async () => {
      ctx.store.insertNode(makeNode({ status: "in_progress" }));
      ctx.store.insertNode(makeDoneTask());

      const res = await request(ctx.app).get("/api/v1/insights/sprint-health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("health");
      expect(["healthy", "at_risk", "critical"]).toContain(res.body.health);
      expect(res.body).toHaveProperty("metrics");
      expect(res.body.metrics).toHaveProperty("taskCount");
      expect(res.body.metrics).toHaveProperty("doneCount");
      expect(res.body.metrics).toHaveProperty("burndownRatio");
      expect(res.body.metrics).toHaveProperty("blockedRatio");
      expect(res.body).toHaveProperty("warnings");
      expect(Array.isArray(res.body.warnings)).toBe(true);
    });

    it("should report critical health when many tasks are blocked", async () => {
      // Create 4 blocked + 1 done = 80% blocked ratio → critical
      ctx.store.insertNode(makeBlockedTask({ status: "blocked" }));
      ctx.store.insertNode(makeBlockedTask({ status: "blocked" }));
      ctx.store.insertNode(makeBlockedTask({ status: "blocked" }));
      ctx.store.insertNode(makeBlockedTask({ status: "blocked" }));
      ctx.store.insertNode(makeDoneTask());

      const res = await request(ctx.app).get("/api/v1/insights/sprint-health");

      expect(res.status).toBe(200);
      expect(res.body.health).toBe("critical");
      expect(res.body.warnings.length).toBeGreaterThan(0);
    });

    it("should accept optional sprint filter", async () => {
      ctx.store.insertNode(makeNode({ sprint: "S1" }));

      const res = await request(ctx.app).get("/api/v1/insights/sprint-health?sprint=S1");

      expect(res.status).toBe(200);
      expect(res.body.sprint).toBe("S1");
    });
  });
});
