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
 * §Story-10 / node_10c0b0434d5e — GET /metrics Prometheus text format
 *
 * AC1: GET /metrics (no param) returns JSON with content-type application/json
 * AC2: GET /metrics?format=prometheus returns Prometheus text with content-type text/plain
 * AC3: Prometheus output includes counter lines for http.requests.total and http.errors.total
 * AC4: Prometheus output includes histogram percentile lines for http.duration.ms
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  httpRequestsTotal,
  httpErrorsTotal,
  httpDurationMs,
  resetAll,
} from "../core/observability/metrics.js";
import { createMetricsRouter } from "../api/routes/metrics.js";

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/metrics", createMetricsRouter());
  return app;
}

beforeEach(() => {
  resetAll();
});

// ── AC1: default is JSON ──────────────────────────────────────────────────────

describe("AC1: GET /metrics default → JSON", () => {
  it("returns 200", async () => {
    const res = await request(makeApp()).get("/metrics");
    expect(res.status).toBe(200);
  });

  it("content-type is application/json", async () => {
    const res = await request(makeApp()).get("/metrics");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("body has counters and histograms keys", async () => {
    const res = await request(makeApp()).get("/metrics");
    expect(res.body).toHaveProperty("counters");
    expect(res.body).toHaveProperty("histograms");
  });
});

// ── AC2: ?format=prometheus → text/plain ─────────────────────────────────────

describe("AC2: GET /metrics?format=prometheus → Prometheus text", () => {
  it("returns 200", async () => {
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    expect(res.status).toBe(200);
  });

  it("content-type is text/plain", async () => {
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
  });

  it("body is a string (not JSON object)", async () => {
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(0);
  });
});

// ── AC3: Prometheus output includes counter lines ─────────────────────────────

describe("AC3: Prometheus output includes counter metric lines", () => {
  it("includes http_requests_total counter line", async () => {
    httpRequestsTotal.increment();
    httpRequestsTotal.increment();
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    expect(res.text).toContain("http_requests_total 2");
  });

  it("includes http_errors_total counter line", async () => {
    httpErrorsTotal.increment(3);
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    expect(res.text).toContain("http_errors_total 3");
  });

  it("counter lines follow Prometheus format: metric_name value", async () => {
    httpRequestsTotal.increment();
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    const lines = res.text.split("\n").filter((l) => !l.startsWith("#") && l.trim());
    expect(lines.some((l) => /^[a-z_]+ \d+$/.test(l))).toBe(true);
  });
});

// ── AC4: Prometheus output includes histogram percentile lines ────────────────

describe("AC4: Prometheus output includes histogram percentile lines", () => {
  it("includes http_duration_ms_p50 gauge line", async () => {
    httpDurationMs.observe(10);
    httpDurationMs.observe(20);
    httpDurationMs.observe(30);
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    expect(res.text).toContain("http_duration_ms_p50");
  });

  it("includes p95 and p99 percentile lines", async () => {
    httpDurationMs.observe(50);
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    expect(res.text).toContain("http_duration_ms_p95");
    expect(res.text).toContain("http_duration_ms_p99");
  });

  it("histogram count line is included", async () => {
    httpDurationMs.observe(10);
    const res = await request(makeApp()).get("/metrics?format=prometheus");
    expect(res.text).toContain("http_duration_ms_count");
  });
});
