/**
 * Token Savings Metrics — tracks compression/caching savings per tool.
 * Uses a simple table that doesn't require project_id.
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS token_savings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tool          TEXT NOT NULL,
    input_tokens  INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    saved_at      TEXT NOT NULL
  )
`;

function ensureTable(db: Database.Database): void {
  db.exec(CREATE_TABLE_SQL);
}

/**
 * Record a token saving event.
 */
export function recordTokenSaving(
  db: Database.Database,
  tool: string,
  inputTokens: number,
  outputTokens: number,
): void {
  ensureTable(db);
  db.prepare(
    "INSERT INTO token_savings (tool, input_tokens, output_tokens, saved_at) VALUES (?, ?, ?, ?)",
  ).run(tool, inputTokens, outputTokens, new Date().toISOString());

  logger.debug("token-savings:record", { tool, inputTokens, outputTokens, saved: inputTokens - outputTokens });
}

export interface ToolSavings {
  tool: string;
  calls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSaved: number;
}

export interface SavingsReport {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSaved: number;
  savingsPercent: number;
  byTool: ToolSavings[];
}

/**
 * Generate a token savings report aggregated by tool.
 */
export function getTokenSavingsReport(db: Database.Database): SavingsReport {
  ensureTable(db);

  const rows = db
    .prepare(
      `SELECT tool, COUNT(*) as calls,
              SUM(input_tokens) as total_input,
              SUM(output_tokens) as total_output
       FROM token_savings
       GROUP BY tool
       ORDER BY (SUM(input_tokens) - SUM(output_tokens)) DESC`,
    )
    .all() as Array<{ tool: string; calls: number; total_input: number; total_output: number }>;

  const byTool: ToolSavings[] = rows.map((r) => ({
    tool: r.tool,
    calls: r.calls,
    totalInputTokens: r.total_input,
    totalOutputTokens: r.total_output,
    totalSaved: r.total_input - r.total_output,
  }));

  const totalInput = byTool.reduce((sum, t) => sum + t.totalInputTokens, 0);
  const totalOutput = byTool.reduce((sum, t) => sum + t.totalOutputTokens, 0);
  const totalSaved = totalInput - totalOutput;
  const savingsPercent = totalInput > 0 ? Math.round((totalSaved / totalInput) * 100) : 0;

  return {
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalSaved,
    savingsPercent,
    byTool,
  };
}
