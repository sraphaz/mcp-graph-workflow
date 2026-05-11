/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * §Story-10 / node_06a30859211f — RED metrics wired into requestLogger
 *
 * AC1: Every completed HTTP request increments http.requests.total
 * AC2: 4xx/5xx responses additionally increment http.errors.total
 * AC3: http.duration.ms histogram records one observation per request
 * AC4: GET /metrics returns JSON snapshot with RED counters and histogram (p50/p95/p99)
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  httpRequestsTotal,
  httpErrorsTotal,
  httpDurationMs,
  getSnapshot,
  resetAll,
} from "../core/observability/metrics.js";
import { requestLogger } from "../api/middleware/request-logger.js";
import { createMetricsRouter } from "../api/routes/metrics.js";

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);
  app.use("/metrics", createMetricsRouter());
  app.get("/ok", (_req, res) => { res.json({ ok: true }); });
  app.get("/fail", (_req, res) => { res.status(500).json({ error: "boom" }); });
  app.get("/notfound", (_req, res) => { res.status(404).json({ error: "nope" }); });
  return app;
}

beforeEach(() => {
  resetAll();
});

// ── AC1: requests.total increments on every request ───────────────────────────

describe("AC1: http.requests.total", () => {
  it("increments by 1 after a 200 request", async () => {
    await request(makeApp()).get("/ok");
    expect(httpRequestsTotal.get()).toBe(1);
  });

  it("increments by 3 after 3 requests", async () => {
    const app = makeApp();
    await request(app).get("/ok");
    await request(app).get("/ok");
    await request(app).get("/ok");
    expect(httpRequestsTotal.get()).toBe(3);
  });
});

// ── AC2: errors.total increments on 4xx/5xx ──────────────────────────────────

describe("AC2: http.errors.total", () => {
  it("increments on 500 response", async () => {
    await request(makeApp()).get("/fail");
    expect(httpErrorsTotal.get()).toBe(1);
  });

  it("increments on 404 response", async () => {
    await request(makeApp()).get("/notfound");
    expect(httpErrorsTotal.get()).toBe(1);
  });

  it("does NOT increment on 200 response", async () => {
    await request(makeApp()).get("/ok");
    expect(httpErrorsTotal.get()).toBe(0);
  });

  it("increments only for error responses in a mixed batch", async () => {
    const app = makeApp();
    await request(app).get("/ok");       // 200 — no error
    await request(app).get("/fail");     // 500 — error
    await request(app).get("/notfound"); // 404 — error
    expect(httpRequestsTotal.get()).toBe(3);
    expect(httpErrorsTotal.get()).toBe(2);
  });
});

// ── AC3: duration histogram records one observation per request ───────────────

describe("AC3: http.duration.ms histogram", () => {
  it("records 1 observation after 1 request", async () => {
    await request(makeApp()).get("/ok");
    expect(httpDurationMs.count()).toBe(1);
  });

  it("records N observations after N requests", async () => {
    const app = makeApp();
    await request(app).get("/ok");
    await request(app).get("/fail");
    expect(httpDurationMs.count()).toBe(2);
  });

  it("duration values are non-negative", async () => {
    const app = makeApp();
    await request(app).get("/ok");
    expect(httpDurationMs.percentile(0.5)).toBeGreaterThanOrEqual(0);
  });
});

// ── AC4: GET /metrics returns RED metrics JSON ────────────────────────────────

describe("AC4: GET /metrics JSON snapshot", () => {
  it("returns 200 with counters and histograms", async () => {
    const res = await request(makeApp()).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("counters");
    expect(res.body).toHaveProperty("histograms");
  });

  it("counters includes http.requests.total and http.errors.total", async () => {
    const app = makeApp();
    await request(app).get("/ok");
    const res = await request(app).get("/metrics");
    const counters = res.body.counters as Record<string, number>;
    expect(typeof counters["http.requests.total"]).toBe("number");
    expect(typeof counters["http.errors.total"]).toBe("number");
  });

  it("histograms includes http.duration.ms with p50/p95/p99", async () => {
    const app = makeApp();
    await request(app).get("/ok");
    const res = await request(app).get("/metrics");
    const hist = (res.body.histograms as Record<string, unknown>)["http.duration.ms"];
    expect(hist).toBeDefined();
    const h = hist as { p50: number; p95: number; p99: number; count: number };
    expect(typeof h.p50).toBe("number");
    expect(typeof h.p95).toBe("number");
    expect(typeof h.p99).toBe("number");
    expect(h.count).toBeGreaterThanOrEqual(1);
  });

  it("snapshot reflects requests made through requestLogger", async () => {
    const app = makeApp();
    await request(app).get("/ok");
    await request(app).get("/fail");
    const snap = getSnapshot();
    expect(snap.counters["http.requests.total"]).toBe(2);
    expect(snap.counters["http.errors.total"]).toBe(1);
  });
});
