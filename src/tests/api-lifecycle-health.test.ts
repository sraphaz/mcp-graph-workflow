/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintF — Lifecycle Health API coverage.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { recordSnapshot } from "../core/analyzer/lifecycle-health-snapshots.js";
import type { LifecycleHealthReport } from "../core/analyzer/prd-lifecycle-health.js";

function fakeReport(epicId: string | null, passedAll: boolean): LifecycleHealthReport {
  return {
    epicId: epicId ?? "",
    phases: {} as LifecycleHealthReport["phases"],
    passedCount: passedAll ? 9 : 5,
    passedAll,
    summary: passedAll ? "all green" : "some red",
  };
}

describe("API /api/v1/lifecycle-health", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /trend", () => {
    it("returns zero-sample shape on an empty store", async () => {
      const res = await request(ctx.app).get("/api/v1/lifecycle-health/trend");
      expect(res.status).toBe(200);
      expect(res.body.samples).toBe(0);
      expect(res.body.successRate).toBe(0);
      expect(res.body.latestPassedAll).toBeNull();
    });

    it("computes pass-rate over recent snapshots", async () => {
      const db = ctx.store.getDb();
      recordSnapshot(db, fakeReport("epic-1", true), "2026-04-25T12:00:00.000Z");
      recordSnapshot(db, fakeReport("epic-1", false), "2026-04-26T12:00:00.000Z");
      recordSnapshot(db, fakeReport("epic-1", true), "2026-04-27T12:00:00.000Z");
      const res = await request(ctx.app).get("/api/v1/lifecycle-health/trend?window=10");
      expect(res.status).toBe(200);
      expect(res.body.samples).toBe(3);
      expect(res.body.passed).toBe(2);
    });

    it("rejects bogus window with 400", async () => {
      const res = await request(ctx.app).get(
        "/api/v1/lifecycle-health/trend?window=notanumber",
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_query");
    });
  });

  describe("GET /snapshots", () => {
    it("returns an empty array on a fresh store", async () => {
      const res = await request(ctx.app).get("/api/v1/lifecycle-health/snapshots");
      expect(res.status).toBe(200);
      expect(res.body.snapshots).toEqual([]);
    });

    it("returns persisted snapshots newest first", async () => {
      const db = ctx.store.getDb();
      recordSnapshot(db, fakeReport("epic-A", true), "2026-04-26T10:00:00.000Z");
      recordSnapshot(db, fakeReport("epic-B", false), "2026-04-27T10:00:00.000Z");
      const res = await request(ctx.app).get("/api/v1/lifecycle-health/snapshots");
      expect(res.status).toBe(200);
      expect(res.body.snapshots).toHaveLength(2);
      expect(res.body.snapshots[0].epicId).toBe("epic-B");
      expect(res.body.snapshots[0].passedAll).toBe(false);
    });

    it("scopes to a specific epic when ?epicId=", async () => {
      const db = ctx.store.getDb();
      recordSnapshot(db, fakeReport("epic-A", true), "2026-04-26T10:00:00.000Z");
      recordSnapshot(db, fakeReport("epic-B", false), "2026-04-27T10:00:00.000Z");
      const res = await request(ctx.app).get(
        "/api/v1/lifecycle-health/snapshots?epicId=epic-A",
      );
      expect(res.status).toBe(200);
      expect(res.body.snapshots).toHaveLength(1);
      expect(res.body.snapshots[0].epicId).toBe("epic-A");
    });
  });

  describe("GET /:epicId", () => {
    it("returns 404 when the epic is missing", async () => {
      const res = await request(ctx.app).get("/api/v1/lifecycle-health/nonexistent-epic");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("epic_not_found");
    });
  });
});
