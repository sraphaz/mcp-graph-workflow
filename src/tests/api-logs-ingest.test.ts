/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { getLogBuffer, clearLogBuffer } from "../core/utils/logger.js";

describe("Logs API — POST /api/v1/logs/ingest", () => {
  let ctx: TestContext;

  beforeEach(() => {
    clearLogBuffer();
    vi.spyOn(console, "error").mockImplementation(() => {});
    ctx = createTestApp();
    clearLogBuffer();
  });

  afterEach(() => {
    ctx.store.close();
    clearLogBuffer();
    vi.restoreAllMocks();
  });

  it("accepts a batch and returns 202 with accepted count (AC1)", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/logs/ingest")
      .send({
        entries: [
          { level: "error", message: "boom", timestamp: "2026-05-03T00:00:00.000Z" },
          { level: "warn", message: "careful" },
        ],
      });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: 2 });
  });

  it("appends entries to log buffer with context.layer='web' forced (AC2)", async () => {
    await request(ctx.app)
      .post("/api/v1/logs/ingest")
      .send({
        entries: [
          {
            level: "error",
            message: "client crash",
            // Client tries to set layer=server — must be overridden
            context: { layer: "server", url: "/x" },
          },
        ],
      });

    const buf = getLogBuffer();
    const entry = buf.find((e) => e.message === "client crash");
    expect(entry).toBeDefined();
    expect(entry?.level).toBe("error");
    expect(entry?.context?.layer).toBe("web");
    expect(entry?.context?.url).toBe("/x");
  });

  it("returns 400 on invalid payload (AC3)", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/logs/ingest")
      .send({ entries: [{ level: "fatal", message: "x" }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.details).toBeDefined();
  });

  it("returns 400 when entries missing (AC3)", async () => {
    const res = await request(ctx.app).post("/api/v1/logs/ingest").send({});
    expect(res.status).toBe(400);
  });

  it("rate-limits at 100 req/min per IP (AC4)", async () => {
    const send = (): Promise<request.Response> =>
      request(ctx.app)
        .post("/api/v1/logs/ingest")
        .set("X-Forwarded-For", "10.0.0.1")
        .send({ entries: [{ level: "info", message: "tick" }] });

    for (let i = 0; i < 100; i++) {
      const r = await send();
      expect(r.status).toBe(202);
    }

    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe("rate_limited");
  });

  it("rate-limit is per-IP — other IPs unaffected (AC5)", async () => {
    const sendAs = (ip: string): Promise<request.Response> =>
      request(ctx.app)
        .post("/api/v1/logs/ingest")
        .set("X-Forwarded-For", ip)
        .send({ entries: [{ level: "info", message: "tick" }] });

    for (let i = 0; i < 100; i++) {
      const r = await sendAs("10.0.0.2");
      expect(r.status).toBe(202);
    }
    const blocked = await sendAs("10.0.0.2");
    expect(blocked.status).toBe(429);

    const other = await sendAs("10.0.0.3");
    expect(other.status).toBe(202);
  });
});
