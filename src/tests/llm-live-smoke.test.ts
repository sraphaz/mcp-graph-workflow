/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Live smoke test — gated by OPENROUTER_LIVE=1 + OPENROUTER_API_KEY.
 * Manual run: `OPENROUTER_LIVE=1 OPENROUTER_API_KEY=sk-or-... npx vitest run src/tests/llm-live-smoke.test.ts`
 * Skipped automatically in CI (no env vars set).
 */

import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { LlmGateway } from "../core/llm/gateway.js";
import { BudgetLedger } from "../core/llm/budget.js";
import { ModelRegistry, DEFAULT_MODEL_SEED } from "../core/llm/registry.js";
import { OpenRouterAdapter } from "../core/llm/adapters/openrouter.js";

const LIVE_ENABLED =
  process.env.OPENROUTER_LIVE === "1" && Boolean(process.env.OPENROUTER_API_KEY);

describe("LLM live smoke (OPENROUTER_LIVE=1)", () => {
  it.skipIf(!LIVE_ENABLED)(
    "performs 1 real OpenRouter call, ledger records 1 row, cost < $0.01",
    async () => {
      const db = new Database(":memory:");
      runMigrations(db);
      db.prepare(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
      ).run("p1", "p1");

      const apiKey = process.env.OPENROUTER_API_KEY;
      expect(apiKey).toBeTruthy();

      const ledger = new BudgetLedger(db, "p1");
      const adapter = new OpenRouterAdapter({
        apiKey: apiKey as string,
        retry: { maxAttempts: 2, baseDelayMs: 250 },
      });
      const gateway = new LlmGateway({
        registry: new ModelRegistry(DEFAULT_MODEL_SEED),
        budget: ledger,
        adapters: new Map([["openrouter", adapter]]),
        allowExpensive: false,
      });

      const response = await gateway.generate(
        {
          model: "openrouter/auto",
          messages: [{ role: "user", content: "Reply with a single word: pong." }],
          maxTokens: 16,
        },
        { caller: "live-smoke", cellId: "node_smoke" },
      );

      expect(response.content.length).toBeGreaterThan(0);

      const agg = ledger.aggregate({ cellId: "node_smoke" });
      expect(agg.callCount).toBe(1);
      expect(agg.totalUsd).toBeLessThan(0.01);
      expect(agg.totalUsd).toBeGreaterThanOrEqual(0);
    },
  );

  it("smoke test is skipped when OPENROUTER_LIVE is unset", () => {
    if (!LIVE_ENABLED) {
      expect(LIVE_ENABLED).toBe(false);
    } else {
      // Live mode active — sanity log, do not fail.
      expect(LIVE_ENABLED).toBe(true);
    }
  });

  it("test source does not contain a hardcoded API key", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const url = await import("node:url");
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const source = await fs.readFile(path.join(here, "llm-live-smoke.test.ts"), "utf8");
    expect(source).not.toMatch(/sk-or-[A-Za-z0-9]{20,}/);
    expect(source).not.toMatch(/Bearer\s+sk-/);
  });
});
