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
 * §Story-9 — Health API endpoints
 *
 * AC1: GET /health returns { status, checks, summary } with HTTP 200 (all ok) or 503 (any error)
 * AC2: GET /health/live always returns 200 { status: 'ok' }
 * AC3: checks array items have name + level + message
 * AC4: status='ok' when no error checks; status='error' when ≥1 error check
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { createHealthRouter, type DoctorFn } from "../api/routes/health.js";
import type { DoctorReport } from "../core/doctor/doctor-types.js";

function makeApp(doctorFn: DoctorFn) {
  const app = express();
  app.use(express.json());
  app.use("/health", createHealthRouter(() => "/tmp", doctorFn));
  return app;
}

function makeReport(overrides: Partial<DoctorReport> = {}): DoctorReport {
  return {
    checks: [
      { name: "node-version", level: "ok", message: "Node.js v22 OK" },
      { name: "config-file", level: "ok", message: "Config valid" },
    ],
    summary: { ok: 2, warning: 0, error: 0 },
    passed: true,
    ...overrides,
  };
}

const okDoctorFn: DoctorFn = async () => makeReport();

const errorDoctorFn: DoctorFn = async () =>
  makeReport({
    checks: [
      { name: "node-version", level: "ok", message: "Node.js v22 OK" },
      { name: "sqlite-database", level: "error", message: "Database not found" },
    ],
    summary: { ok: 1, warning: 0, error: 1 },
    passed: false,
  });

// ── AC1: readiness shape ──────────────────────────────────────────────────────

describe("GET /health — AC1: readiness shape", () => {
  it("AC1: returns { status, checks, summary } fields", async () => {
    const res = await request(makeApp(okDoctorFn)).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("checks");
    expect(res.body).toHaveProperty("summary");
  });

  it("AC1: checks is an array", async () => {
    const res = await request(makeApp(okDoctorFn)).get("/health");
    expect(Array.isArray(res.body.checks)).toBe(true);
  });
});

// ── AC2: liveness always 200 ──────────────────────────────────────────────────

describe("GET /health/live — AC2: liveness", () => {
  it("AC2: returns 200", async () => {
    const res = await request(makeApp(okDoctorFn)).get("/health/live");
    expect(res.status).toBe(200);
  });

  it("AC2: returns { status: 'ok' }", async () => {
    const res = await request(makeApp(okDoctorFn)).get("/health/live");
    expect(res.body.status).toBe("ok");
  });
});

// ── AC3: check item shape ─────────────────────────────────────────────────────

describe("GET /health — AC3: check item shape", () => {
  it("AC3: each check has name, level, message", async () => {
    const res = await request(makeApp(okDoctorFn)).get("/health");
    for (const check of res.body.checks as Array<unknown>) {
      const c = check as Record<string, unknown>;
      expect(typeof c["name"]).toBe("string");
      expect(typeof c["level"]).toBe("string");
      expect(typeof c["message"]).toBe("string");
    }
  });
});

// ── AC4: status mapping ───────────────────────────────────────────────────────

describe("GET /health — AC4: status mapping", () => {
  it("AC4: status=ok when all checks pass (HTTP 200)", async () => {
    const res = await request(makeApp(okDoctorFn)).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("AC4: status=error when any check errors (HTTP 503)", async () => {
    const res = await request(makeApp(errorDoctorFn)).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("error");
  });
});
