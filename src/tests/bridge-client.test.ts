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

import { describe, it, expect } from "vitest";
import {
  BridgeClient,
  computeBackoffSchedule,
} from "../core/browser-pilot/bridge-client.js";

/** Fetch double — counts calls and replays a queued sequence of responses. */
type Fake = typeof fetch;

interface FakeFetchHandle {
  fn: Fake;
  readonly calls: number;
}

function fakeFetch(responses: Array<Response | Error>): FakeFetchHandle {
  let i = 0;
  const state = { calls: 0 };
  const fn = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
    state.calls++;
    if (i >= responses.length) throw new Error("fakeFetch: exhausted");
    const next = responses[i++];
    if (next instanceof Error) throw next;
    return next;
  }) as Fake;
  return {
    fn,
    get calls() { return state.calls; },
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("computeBackoffSchedule — Copilot Bridge Sprint 1.10", () => {
  it("starts at 250ms and doubles each step", () => {
    const sched = computeBackoffSchedule({ initialMs: 250, maxMs: 4000, budgetMs: 30_000 });
    expect(sched[0]).toBe(250);
    expect(sched[1]).toBe(500);
    expect(sched[2]).toBe(1000);
    expect(sched[3]).toBe(2000);
    expect(sched[4]).toBe(4000);
  });

  it("caps subsequent delays at maxMs", () => {
    const sched = computeBackoffSchedule({ initialMs: 250, maxMs: 4000, budgetMs: 30_000 });
    // Once it reaches 4000 it stays there until budget is exhausted.
    const after = sched.slice(5);
    for (const d of after) expect(d).toBe(4000);
  });

  it("stops accumulating once cumulative > budget", () => {
    const sched = computeBackoffSchedule({ initialMs: 250, maxMs: 4000, budgetMs: 30_000 });
    const total = sched.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(30_000);
    // The schedule cannot fit one more 4000ms tick without breaching budget.
    expect(total + 4000).toBeGreaterThan(30_000);
  });

  it("returns at least one delay for any positive budget", () => {
    const sched = computeBackoffSchedule({ initialMs: 250, maxMs: 4000, budgetMs: 250 });
    expect(sched.length).toBeGreaterThanOrEqual(1);
    expect(sched[0]).toBe(250);
  });
});

describe("BridgeClient.health — Copilot Bridge Sprint 1.10", () => {
  it("returns parsed body when /health responds 200", async () => {
    const f = fakeFetch([json(200, { ok: true, models: ["claude-3.5-sonnet", "gpt-4o"] })]);
    const c = new BridgeClient("http://127.0.0.1:9876/v1", { fetchImpl: f.fn, sleep: async () => {} });
    const r = await c.health();
    expect(r.ok).toBe(true);
    expect(r.models).toEqual(["claude-3.5-sonnet", "gpt-4o"]);
    expect(f.calls).toBe(1);
  });

  it("throws structured error on non-200", async () => {
    const f = fakeFetch([json(503, { error: "starting" })]);
    const c = new BridgeClient("http://127.0.0.1:9876/v1", { fetchImpl: f.fn, sleep: async () => {} });
    await expect(c.health()).rejects.toThrow(/503/);
  });

  it("throws when network fails (ECONNREFUSED)", async () => {
    const f = fakeFetch([new Error("connect ECONNREFUSED 127.0.0.1:9876")]);
    const c = new BridgeClient("http://127.0.0.1:9876/v1", { fetchImpl: f.fn, sleep: async () => {} });
    await expect(c.health()).rejects.toThrow(/ECONNREFUSED/);
  });

  it("hits {bridgeUrl}/health (path joined safely with or without trailing slash)", async () => {
    const observed: string[] = [];
    const fn = (async (input: RequestInfo | URL) => {
      observed.push(typeof input === "string" ? input : input.toString());
      return json(200, { ok: true, models: [] });
    }) as Fake;
    const c1 = new BridgeClient("http://127.0.0.1:9876/v1", { fetchImpl: fn, sleep: async () => {} });
    await c1.health();
    const c2 = new BridgeClient("http://127.0.0.1:9876/v1/", { fetchImpl: fn, sleep: async () => {} });
    await c2.health();
    expect(observed[0]).toBe("http://127.0.0.1:9876/v1/health");
    expect(observed[1]).toBe("http://127.0.0.1:9876/v1/health");
  });
});

describe("BridgeClient.ensureReady — Copilot Bridge Sprint 1.10", () => {
  it("returns immediately on first 200", async () => {
    const f = fakeFetch([json(200, { ok: true, models: [] })]);
    const c = new BridgeClient("http://127.0.0.1:9876/v1", { fetchImpl: f.fn, sleep: async () => {} });
    const r = await c.ensureReady();
    expect(r.ok).toBe(true);
    expect(f.calls).toBe(1);
  });

  it("retries on 503 and succeeds when bridge comes up", async () => {
    const f = fakeFetch([
      json(503, { error: "starting" }),
      json(503, { error: "starting" }),
      json(200, { ok: true, models: [] }),
    ]);
    const c = new BridgeClient("http://127.0.0.1:9876/v1", { fetchImpl: f.fn, sleep: async () => {} });
    const r = await c.ensureReady();
    expect(r.ok).toBe(true);
    expect(f.calls).toBe(3);
  });

  it("retries on ECONNREFUSED and succeeds when bridge comes up", async () => {
    const f = fakeFetch([
      new Error("ECONNREFUSED"),
      new Error("ECONNREFUSED"),
      json(200, { ok: true, models: [] }),
    ]);
    const c = new BridgeClient("http://127.0.0.1:9876/v1", { fetchImpl: f.fn, sleep: async () => {} });
    const r = await c.ensureReady();
    expect(r.ok).toBe(true);
    expect(f.calls).toBe(3);
  });

  it("throws after exhausting the budget", async () => {
    // 30s budget at 250→4000 backoff allows ~10 attempts; supply only 503s.
    const responses = Array.from({ length: 30 }, () => json(503, { error: "starting" }));
    const f = fakeFetch(responses);
    const c = new BridgeClient("http://127.0.0.1:9876/v1", {
      fetchImpl: f.fn,
      sleep: async () => {},
      backoff: { initialMs: 250, maxMs: 4000, budgetMs: 30_000 },
    });
    await expect(c.ensureReady()).rejects.toThrow(/bridge_unreachable/);
  });

  it("respects a small custom budget (1 attempt only)", async () => {
    const f = fakeFetch([json(503, {})]);
    const c = new BridgeClient("http://127.0.0.1:9876/v1", {
      fetchImpl: f.fn,
      sleep: async () => {},
      backoff: { initialMs: 250, maxMs: 4000, budgetMs: 200 },
    });
    await expect(c.ensureReady()).rejects.toThrow();
    // initialMs > budget → schedule still has 1 entry, we should attempt at least once.
    expect(f.calls).toBeGreaterThanOrEqual(1);
  });
});
