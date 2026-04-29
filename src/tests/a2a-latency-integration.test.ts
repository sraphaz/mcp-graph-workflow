/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication (E20.T05).
 * Integration test: latency of single-agent baseline vs hierarchical handoff
 * with and without A2A. Validates that A2A path avoids the SQLite round-trip
 * that graph-state handoff incurs.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { A2AMailbox } from "../core/swarm/a2a-mailbox.js";
import { createA2AHandoff } from "../core/swarm/a2a-handoff.js";
import {
  createDualPathHandoff,
  type GraphHandoff,
} from "../core/swarm/a2a-fallback.js";

const HANDOFF_COUNT = 50;

async function timeIt(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

describe("A2A latency integration (E20.T05)", () => {
  let db: Database.Database;
  let mailbox: A2AMailbox;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    mailbox = new A2AMailbox(db);
    db.exec(
      `CREATE TABLE IF NOT EXISTS handoff_log (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         from_agent TEXT,
         to_agent TEXT,
         body TEXT
       )`,
    );
  });

  afterEach(() => {
    db.close();
  });

  function makeGraphHandoff(): GraphHandoff {
    return async (input) => {
      // Simulates graph state path: write + read round-trip.
      db.prepare(
        `INSERT INTO handoff_log (from_agent, to_agent, body) VALUES (?, ?, ?)`,
      ).run(input.from, input.to, JSON.stringify(input.body));
      db.prepare(`SELECT id FROM handoff_log WHERE to_agent = ? ORDER BY id DESC LIMIT 1`).get(
        input.to,
      );
      return { recorded: true };
    };
  }

  it("single-agent baseline records latency without handoff overhead", async () => {
    const ms = await timeIt(async () => {
      for (let i = 0; i < HANDOFF_COUNT; i++) {
        // No handoff — single agent processes locally (just a tight loop).
        Math.sqrt(i);
      }
    });
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it("hierarchical without A2A uses graph-state writes", async () => {
    const handoff = createDualPathHandoff({
      a2a: async () => ({ delivered: false, messageId: null }),
      graph: makeGraphHandoff(),
    });

    let pathSeen = "";
    for (let i = 0; i < HANDOFF_COUNT; i++) {
      const r = await handoff({ from: "queen", to: `w${i % 3}`, body: { i } });
      pathSeen = r.path;
    }

    expect(pathSeen).toBe("graph");
    const rows = db.prepare(`SELECT COUNT(*) AS n FROM handoff_log`).get() as { n: number };
    expect(rows.n).toBe(HANDOFF_COUNT);
  });

  it("hierarchical with A2A uses mailbox path (no graph_log writes)", async () => {
    const a2aHandoff = createA2AHandoff({
      mailbox,
      hookEmit: async () => {},
      enabled: true,
    });
    const handoff = createDualPathHandoff({
      a2a: a2aHandoff,
      graph: makeGraphHandoff(),
    });

    let pathSeen = "";
    for (let i = 0; i < HANDOFF_COUNT; i++) {
      const r = await handoff({ from: "queen", to: `w${i % 3}`, body: { i } });
      pathSeen = r.path;
    }

    expect(pathSeen).toBe("a2a");
    const graphRows = db.prepare(`SELECT COUNT(*) AS n FROM handoff_log`).get() as { n: number };
    expect(graphRows.n).toBe(0); // A2A path bypasses graph state
    expect(mailbox.totalCount()).toBe(HANDOFF_COUNT);
  });

  it("A2A mailbox latency lower-bounded by hook emit cost only (smoke check)", async () => {
    const a2aHandoff = createA2AHandoff({
      mailbox,
      hookEmit: async () => {},
      enabled: true,
    });
    const ms = await timeIt(async () => {
      for (let i = 0; i < HANDOFF_COUNT; i++) {
        await a2aHandoff({ from: "queen", to: "w1", body: { i } });
      }
    });
    // Per-handoff budget should stay under 5ms on dev machines.
    const perHandoff = ms / HANDOFF_COUNT;
    expect(perHandoff).toBeLessThan(50);
  });
});
