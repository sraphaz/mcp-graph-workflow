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
 * §Story-9 — Logs tab filterable by event.category=health
 *
 * AC1: GET /logs?category=health returns only entries with context.eventCategory='health'
 * AC2: GET /logs without category returns all entries (backward-compat)
 * AC3: GET /logs?category=health with no health entries returns empty array
 * AC4: category filter is case-sensitive ('health' ≠ 'Health')
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { clearLogBuffer, logger } from "../core/utils/logger.js";
import { createLogsRouter } from "../api/routes/logs.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/logs", createLogsRouter());
  return app;
}

beforeEach(() => {
  clearLogBuffer();
});

// ── AC1: category filter returns only health events ───────────────────────────

describe("GET /logs?category=health — AC1: filters by eventCategory", () => {
  it("AC1: returns only health events when category=health", async () => {
    logger.event({ action: "health.check", category: "health", outcome: "success" }, "health-msg", {});
    logger.info("non-health msg", { layer: "core" });

    const res = await request(makeApp()).get("/logs?category=health");
    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
    const logs = res.body.logs as Array<{ context?: Record<string, unknown> }>;
    expect(logs.length).toBeGreaterThanOrEqual(1);
    for (const entry of logs) {
      expect(entry.context?.["eventCategory"]).toBe("health");
    }
  });

  it("AC1: excludes non-health entries from category=health result", async () => {
    logger.info("non-health msg", { layer: "core" });

    const res = await request(makeApp()).get("/logs?category=health");
    const logs = res.body.logs as Array<{ context?: Record<string, unknown> }>;
    for (const entry of logs) {
      expect(entry.context?.["eventCategory"]).toBe("health");
    }
  });
});

// ── AC2: no category param = all entries ──────────────────────────────────────

describe("GET /logs (no category) — AC2: backward compat", () => {
  it("AC2: returns all entries when no category filter", async () => {
    logger.event({ action: "health.check", category: "health", outcome: "success" }, "health-msg", {});
    logger.info("other msg", {});

    const res = await request(makeApp()).get("/logs");
    expect(res.status).toBe(200);
    expect((res.body.logs as unknown[]).length).toBeGreaterThanOrEqual(2);
  });
});

// ── AC3: category=health with no health entries → empty ───────────────────────

describe("GET /logs?category=health — AC3: empty when no health events", () => {
  it("AC3: returns empty array when no health events in buffer", async () => {
    logger.info("just a regular log", {});

    const res = await request(makeApp()).get("/logs?category=health");
    expect(res.status).toBe(200);
    expect((res.body.logs as unknown[]).length).toBe(0);
  });
});

// ── AC4: category filter is case-sensitive ────────────────────────────────────

describe("GET /logs?category — AC4: case-sensitive", () => {
  it("AC4: category=Health (capital H) does not match health events", async () => {
    logger.event({ action: "health.check", category: "health", outcome: "success" }, "health-msg", {});

    const res = await request(makeApp()).get("/logs?category=Health");
    const logs = res.body.logs as Array<{ context?: Record<string, unknown> }>;
    for (const entry of logs) {
      expect(entry.context?.["eventCategory"]).toBe("Health");
    }
  });
});
