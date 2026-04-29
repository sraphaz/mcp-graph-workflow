/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-11.T04 — cost aggregator tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  costByNode,
  sessionCost,
  CACHE_DISCOUNT_RATIO,
  DEFAULT_INPUT_RATE_USD_PER_TOKEN,
} from "../core/llm/cost-aggregator.js";

function seed(db: Database.Database) {
  db.prepare(
    `INSERT INTO projects (id, name, created_at, updated_at)
     VALUES ('p1','Test','2026-01-01','2026-01-01')`,
  ).run();
  // tree: epic → task → subtask
  const now = "2026-04-29T00:00:00Z";
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at, parent_id)
     VALUES ('epic','p1','epic','E','backlog',3,?,?,NULL),
            ('task','p1','task','T','backlog',3,?,?,'epic'),
            ('sub','p1','subtask','S','backlog',3,?,?,'task'),
            ('outside','p1','task','O','backlog',3,?,?,NULL)`,
  ).run(now, now, now, now, now, now, now, now);
}

function ledgerInsert(
  db: Database.Database,
  row: {
    id: string;
    nodeId: string | null;
    runId?: string;
    provider: string;
    model: string;
    costUsd: number;
    cachedTokens?: number;
  },
) {
  db.prepare(
    `INSERT INTO llm_call_ledger
       (id, ts, project_id, node_id, run_id, provider, model,
        input_tokens, output_tokens, cached_input_tokens, cost_usd, status)
     VALUES (?, ?, 'p1', ?, ?, ?, ?, 100, 50, ?, ?, 'ok')`,
  ).run(
    row.id,
    Date.now(),
    row.nodeId,
    row.runId ?? null,
    row.provider,
    row.model,
    row.cachedTokens ?? null,
    row.costUsd,
  );
}

describe("cost-aggregator (E11.T04)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    seed(db);
  });

  afterEach(() => {
    db.close();
  });

  it("constants: CACHE_DISCOUNT_RATIO = 0.9", () => {
    expect(CACHE_DISCOUNT_RATIO).toBe(0.9);
    expect(DEFAULT_INPUT_RATE_USD_PER_TOKEN).toBeGreaterThan(0);
  });

  describe("costByNode", () => {
    it("returns zeros when no ledger rows match", () => {
      const r = costByNode(db, "epic");
      expect(r).toEqual({ totalUsd: 0, callCount: 0, byProvider: {}, byModel: {} });
    });

    it("aggregates direct + descendant nodes via recursive CTE", () => {
      ledgerInsert(db, { id: "l1", nodeId: "epic", provider: "anthropic", model: "sonnet", costUsd: 0.1 });
      ledgerInsert(db, { id: "l2", nodeId: "task", provider: "anthropic", model: "sonnet", costUsd: 0.2 });
      ledgerInsert(db, { id: "l3", nodeId: "sub",  provider: "openai",    model: "gpt-4",  costUsd: 0.05 });
      ledgerInsert(db, { id: "l4", nodeId: "outside", provider: "anthropic", model: "haiku", costUsd: 99 });

      const r = costByNode(db, "epic");
      expect(r.callCount).toBe(3);
      expect(r.totalUsd).toBeCloseTo(0.35);
      expect(r.byProvider.anthropic).toBeCloseTo(0.3);
      expect(r.byProvider.openai).toBeCloseTo(0.05);
      expect(r.byModel.sonnet).toBeCloseTo(0.3);
    });

    it("scoped to leaf node returns only that node's calls", () => {
      ledgerInsert(db, { id: "l1", nodeId: "task", provider: "anthropic", model: "sonnet", costUsd: 0.2 });
      ledgerInsert(db, { id: "l2", nodeId: "sub",  provider: "anthropic", model: "haiku",  costUsd: 0.05 });
      const r = costByNode(db, "sub");
      expect(r.callCount).toBe(1);
      expect(r.totalUsd).toBeCloseTo(0.05);
    });
  });

  describe("sessionCost", () => {
    it("aggregates all rows when no runId filter", () => {
      ledgerInsert(db, { id: "l1", nodeId: null, provider: "anthropic", model: "sonnet", costUsd: 0.1 });
      ledgerInsert(db, { id: "l2", nodeId: null, provider: "openai",    model: "gpt-4",  costUsd: 0.2 });
      const r = sessionCost(db);
      expect(r.callCount).toBe(2);
      expect(r.totalUsd).toBeCloseTo(0.3);
      expect(r.savedViaCacheUsd).toBe(0);
    });

    it("filters by runId", () => {
      ledgerInsert(db, { id: "l1", nodeId: null, runId: "r1", provider: "a", model: "m", costUsd: 0.1 });
      ledgerInsert(db, { id: "l2", nodeId: null, runId: "r2", provider: "a", model: "m", costUsd: 0.2 });
      const r = sessionCost(db, { runId: "r1" });
      expect(r.callCount).toBe(1);
      expect(r.totalUsd).toBeCloseTo(0.1);
    });

    it("computes savedViaCacheUsd from cached_input_tokens (90% of input rate)", () => {
      ledgerInsert(db, {
        id: "l1", nodeId: null, provider: "anthropic", model: "sonnet",
        costUsd: 0.05, cachedTokens: 1_000_000,
      });
      const r = sessionCost(db, { inputRateUsdPerToken: 3 / 1_000_000 });
      expect(r.cachedTokensTotal).toBe(1_000_000);
      // 1M tokens * (3/1M) * 0.9 = 2.7 USD saved
      expect(r.savedViaCacheUsd).toBeCloseTo(2.7);
    });

    it("returns empty/zero on empty ledger", () => {
      const r = sessionCost(db);
      expect(r.callCount).toBe(0);
      expect(r.totalUsd).toBe(0);
      expect(r.savedViaCacheUsd).toBe(0);
      expect(r.byProvider).toEqual({});
    });
  });
});
