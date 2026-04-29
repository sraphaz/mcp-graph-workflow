/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.B5 — cost runaway pause hook tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  handleCostRunaway,
  isCostRunawayGuardDisabled,
} from "../core/autonomy/cost-runaway-guard.js";

describe("cost-runaway-guard (E22.B5)", () => {
  let env: NodeJS.ProcessEnv;
  let events: Array<{ event: string; payload: Record<string, unknown> }>;
  const emitEvent = (event: string, payload: Record<string, unknown>) => {
    events.push({ event, payload });
  };

  beforeEach(() => {
    env = {} as NodeJS.ProcessEnv;
    events = [];
  });

  it("isCostRunawayGuardDisabled respects MCP_GRAPH_COST_RUNAWAY_GUARD=off", () => {
    expect(isCostRunawayGuardDisabled({ MCP_GRAPH_COST_RUNAWAY_GUARD: "off" })).toBe(true);
    expect(isCostRunawayGuardDisabled({})).toBe(false);
  });

  it("sets MCP_GRAPH_AUTOPILOT_PAUSED=true", () => {
    handleCostRunaway({ totalUsd: 1.2, capUsd: 1.0 }, { env, emitEvent });
    expect(env.MCP_GRAPH_AUTOPILOT_PAUSED).toBe("true");
  });

  it("emits approval:required with reason='cost_runaway'", () => {
    handleCostRunaway(
      { totalUsd: 1.5, capUsd: 1.0, sprintId: "s1" },
      { env, emitEvent },
    );
    const approvals = events.filter((e) => e.event === "approval:required");
    expect(approvals).toHaveLength(1);
    expect(approvals[0].payload.reason).toBe("cost_runaway");
    expect(approvals[0].payload.sprintId).toBe("s1");
    expect(approvals[0].payload.totalUsd).toBe(1.5);
    expect(approvals[0].payload.capUsd).toBe(1.0);
  });

  it("idempotent: calling twice does not throw and reports alreadyPaused", () => {
    const r1 = handleCostRunaway({ totalUsd: 1.1, capUsd: 1.0 }, { env, emitEvent });
    expect(r1.alreadyPaused).toBe(false);
    expect(r1.paused).toBe(true);

    const r2 = handleCostRunaway({ totalUsd: 1.2, capUsd: 1.0 }, { env, emitEvent });
    expect(r2.alreadyPaused).toBe(true);
    expect(r2.paused).toBe(true);
  });

  it("skips when guard is disabled via env", () => {
    env.MCP_GRAPH_COST_RUNAWAY_GUARD = "off";
    const result = handleCostRunaway({ totalUsd: 1, capUsd: 1 }, { env, emitEvent });
    expect(result.skipped).toBe("disabled");
    expect(result.paused).toBe(false);
    expect(env.MCP_GRAPH_AUTOPILOT_PAUSED).toBeUndefined();
    expect(events).toHaveLength(0);
  });

  it("marks sprint as blocked when db + sprintId provided", () => {
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE sprints (id TEXT PRIMARY KEY, status TEXT NOT NULL)`);
    db.prepare(`INSERT INTO sprints (id, status) VALUES ('s1', 'active')`).run();

    const result = handleCostRunaway(
      { totalUsd: 1.5, capUsd: 1.0, sprintId: "s1" },
      { env, db, emitEvent },
    );
    expect(result.sprintBlocked).toBe(true);

    const row = db.prepare(`SELECT status FROM sprints WHERE id = 's1'`).get() as { status: string };
    expect(row.status).toBe("blocked");
    db.close();
  });

  it("does NOT throw when sprints table missing (best-effort)", () => {
    const db = new Database(":memory:");
    expect(() => {
      handleCostRunaway(
        { totalUsd: 1.5, capUsd: 1.0, sprintId: "s1" },
        { env, db, emitEvent },
      );
    }).not.toThrow();
    db.close();
  });

  it("does NOT re-block sprint already blocked (changes=0)", () => {
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE sprints (id TEXT PRIMARY KEY, status TEXT NOT NULL)`);
    db.prepare(`INSERT INTO sprints (id, status) VALUES ('s1', 'blocked')`).run();

    const result = handleCostRunaway(
      { totalUsd: 1.5, capUsd: 1.0, sprintId: "s1" },
      { env, db, emitEvent },
    );
    expect(result.sprintBlocked).toBe(false);
    db.close();
  });
});
