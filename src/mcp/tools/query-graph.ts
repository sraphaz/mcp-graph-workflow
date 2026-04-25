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
 * query_graph — Read-only SQL bridge to the graph database (V11 Maestro Phase 2).
 *
 * Replaces ad-hoc `sqlite3` use with a guarded MCP tool: SELECT-only,
 * negative whitelist, statement-separator detection, LIMIT injection,
 * 2s timeout, and audit log via tool_call_log.
 *
 * Decisions justified in docs/adr/0042-maestro-surface-refactor.md.
 */

import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { ToolCallLog } from "../../core/store/tool-call-log.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const QUERY_TIMEOUT_MS = 2000;

// Negative whitelist — SQL must not contain ANY of these as standalone tokens.
// The matcher uses word boundaries plus a comment-stripped scan so attempts to
// hide forbidden keywords inside block or line comments are still blocked.
const FORBIDDEN_KEYWORDS = [
  "ATTACH", "DETACH", "PRAGMA",
  "UPDATE", "INSERT", "DELETE", "REPLACE",
  "DROP", "ALTER", "CREATE", "TRUNCATE",
  "TRIGGER", "VACUUM", "REINDEX",
] as const;

const FORBIDDEN_TABLES = ["sqlite_master", "sqlite_schema", "sqlite_temp_master", "sqlite_temp_schema"] as const;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

// Strip SQL comments so a hidden block-comment DROP cannot bypass the whitelist.
// Single-quoted strings are preserved verbatim to avoid mangling user data.
function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  let inStr: '"' | "'" | null = null;
  while (i < sql.length) {
    const c = sql[i];
    if (inStr) {
      out += c;
      if (c === inStr) {
        if (sql[i + 1] === inStr) { out += sql[i + 1]; i += 2; continue; }
        inStr = null;
      }
      i++;
      continue;
    }
    if (c === "'" || c === '"') { inStr = c; out += c; i++; continue; }
    if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Detects a statement separator (`;` outside strings) followed by more SQL.
 * A trailing `;` with only whitespace after is allowed (single statement).
 */
function hasMultiStatement(sql: string): boolean {
  let inStr: '"' | "'" | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inStr) {
      if (c === inStr) {
        if (sql[i + 1] === inStr) { i++; continue; }
        inStr = null;
      }
      continue;
    }
    if (c === "'" || c === '"') { inStr = c; continue; }
    if (c === ";") {
      const rest = sql.slice(i + 1).trim();
      if (rest.length > 0) return true;
    }
  }
  return false;
}

/**
 * Validate a SQL string against the SELECT-only whitelist (Task 2.1).
 *
 * Pure function — no DB access. Used by both `executeQueryGraph` and the
 * Zod schema in `registerQueryGraph` (early-rejection before binding params).
 */
export function validateQueryGraphSql(rawSql: string): ValidationResult {
  if (typeof rawSql !== "string" || rawSql.trim().length === 0) {
    return { ok: false, reason: "SQL is empty" };
  }

  // Multi-statement check uses the ORIGINAL sql so that `;` inside a string
  // literal is correctly skipped. Comment stripping happens after.
  if (hasMultiStatement(rawSql)) {
    return { ok: false, reason: "Multi-statement queries are not allowed" };
  }

  const stripped = stripComments(rawSql).trim();
  if (!/^select\b/i.test(stripped)) {
    return { ok: false, reason: "Only SELECT statements are allowed" };
  }

  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(stripped) || re.test(rawSql)) {
      return { ok: false, reason: `Forbidden keyword: ${kw}` };
    }
  }

  for (const tbl of FORBIDDEN_TABLES) {
    const re = new RegExp(`\\b${tbl}\\b`, "i");
    if (re.test(stripped)) {
      return { ok: false, reason: `Forbidden table: ${tbl}` };
    }
  }

  return { ok: true };
}

export interface InjectLimitResult {
  sql: string;
  limitInjected: boolean;
  limitCapped: boolean;
}

// Inject LIMIT N at the end if missing; cap to maxLimit if existing > max.
// Trailing semicolon is stripped before injection so the result is `SELECT ... LIMIT N`.
export function injectLimit(rawSql: string, defaultLimit: number, maxLimit: number): InjectLimitResult {
  const trimmed = rawSql.trim().replace(/;\s*$/, "");
  const limitMatch = /\bLIMIT\s+(\d+)/i.exec(trimmed);
  if (limitMatch) {
    const existing = parseInt(limitMatch[1], 10);
    if (existing > maxLimit) {
      return {
        sql: trimmed.replace(/\bLIMIT\s+\d+/i, `LIMIT ${maxLimit}`),
        limitInjected: false,
        limitCapped: true,
      };
    }
    return { sql: trimmed, limitInjected: false, limitCapped: false };
  }
  return { sql: `${trimmed} LIMIT ${defaultLimit}`, limitInjected: true, limitCapped: false };
}

export interface QueryGraphInput {
  sql: string;
  params?: ReadonlyArray<string | number | boolean | null>;
  limit?: number;
}

export type QueryGraphResult =
  | {
      ok: true;
      rows: Array<Record<string, unknown>>;
      rowCount: number;
      truncated: boolean;
      auditId: string;
      durationMs: number;
      limitInjected: boolean;
      limitCapped: boolean;
    }
  | {
      ok: false;
      error: string;
      auditId: string;
      durationMs: number;
    };

/**
 * Audit a query_graph call into tool_call_log (Task 2.3).
 * Always called — for both successful and rejected queries — so the audit
 * trail captures attempted SQL injection too.
 */
function audit(
  store: SqliteStore,
  payload: {
    auditId: string;
    sql: string;
    params: ReadonlyArray<unknown> | undefined;
    rowCount: number;
    durationMs: number;
    rejected: boolean;
    error?: string;
  },
): void {
  try {
    const project = store.getProject();
    if (!project) return;
    const log = new ToolCallLog(store.getDb());
    log.record(
      project.id,
      null,
      "query_graph",
      JSON.stringify({
        auditId: payload.auditId,
        sql: payload.sql,
        params: payload.params ?? [],
        rowCount: payload.rowCount,
        durationMs: payload.durationMs,
        rejected: payload.rejected,
        ...(payload.error ? { error: payload.error } : {}),
      }),
    );
  } catch (err) {
    logger.debug("query_graph: audit skipped", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Execute a query_graph call end-to-end (Task 2.2 + 2.3).
 *
 * Flow: validate → inject LIMIT → prepare → iterate up to cap → audit.
 * Rejected queries are also audited so SQL injection attempts are traceable.
 */
export function executeQueryGraph(store: SqliteStore, input: QueryGraphInput): QueryGraphResult {
  const auditId = randomUUID();
  const startedAt = Date.now();

  const validation = validateQueryGraphSql(input.sql);
  if (!validation.ok) {
    const durationMs = Date.now() - startedAt;
    audit(store, {
      auditId,
      sql: input.sql,
      params: input.params,
      rowCount: 0,
      durationMs,
      rejected: true,
      error: validation.reason,
    });
    return { ok: false, error: validation.reason, auditId, durationMs };
  }

  const limit = input.limit ?? DEFAULT_LIMIT;
  const cap = Math.min(Math.max(1, limit), MAX_LIMIT);
  const { sql: finalSql, limitInjected, limitCapped } = injectLimit(input.sql, cap, MAX_LIMIT);

  let stmt: ReturnType<ReturnType<typeof store.getDb>["prepare"]>;
  try {
    stmt = store.getDb().prepare(finalSql);
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const error = err instanceof Error ? err.message : "prepare_failed";
    audit(store, {
      auditId,
      sql: input.sql,
      params: input.params,
      rowCount: 0,
      durationMs,
      rejected: true,
      error,
    });
    return { ok: false, error, auditId, durationMs };
  }

  const rows: Array<Record<string, unknown>> = [];
  let truncated = false;
  try {
    const bindParams = (input.params ?? []) as Array<string | number | boolean | null>;
    const iterator = (stmt.iterate as (...bind: unknown[]) => IterableIterator<unknown>)(...bindParams);
    for (const row of iterator) {
      rows.push(row as Record<string, unknown>);
      if (rows.length >= cap) {
        truncated = true;
        // Drain & abort — better-sqlite3 needs us to stop iterating.
        try { (iterator as unknown as { return?: () => void }).return?.(); } catch { /* noop */ }
        break;
      }
      if (Date.now() - startedAt > QUERY_TIMEOUT_MS) {
        const durationMs = Date.now() - startedAt;
        audit(store, {
          auditId,
          sql: input.sql,
          params: input.params,
          rowCount: rows.length,
          durationMs,
          rejected: true,
          error: "timeout",
        });
        return { ok: false, error: "Query exceeded 2s timeout", auditId, durationMs };
      }
    }
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const error = err instanceof Error ? err.message : "execute_failed";
    audit(store, {
      auditId,
      sql: input.sql,
      params: input.params,
      rowCount: rows.length,
      durationMs,
      rejected: true,
      error,
    });
    return { ok: false, error, auditId, durationMs };
  }

  const durationMs = Date.now() - startedAt;
  audit(store, {
    auditId,
    sql: input.sql,
    params: input.params,
    rowCount: rows.length,
    durationMs,
    rejected: false,
  });

  return {
    ok: true,
    rows,
    rowCount: rows.length,
    truncated,
    auditId,
    durationMs,
    limitInjected,
    limitCapped,
  };
}

/** Register the query_graph MCP tool with the server (Task 2.1 + 2.2 + 2.3). */
export function registerQueryGraph(server: McpServer, store: SqliteStore): void {
  server.tool(
    "query_graph",
    "Read-only SQL bridge to the graph database (V11 Maestro). SELECT-only with negative whitelist (DROP/UPDATE/INSERT/etc. rejected), statement-separator detection, LIMIT injection (default 100, max 500), 2s timeout, and audit log to tool_call_log.",
    {
      sql: z.string().min(1).describe("A single SELECT statement. Forbidden: ATTACH, PRAGMA, UPDATE, INSERT, DELETE, DROP, ALTER, CREATE, REPLACE, TRIGGER, VACUUM, REINDEX, sqlite_master, sqlite_schema."),
      params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe("Bind params for ? placeholders."),
      limit: z.number().int().positive().max(MAX_LIMIT).optional().describe(`Row cap, default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}. LIMIT is injected if absent.`),
    },
    async ({ sql, params, limit }) => {
      const result = executeQueryGraph(store, { sql, params, limit });
      logger.debug("tool:query_graph", {
        ok: result.ok,
        durationMs: result.durationMs,
        auditId: result.auditId,
      });
      return mcpText(result);
    },
  );
}
