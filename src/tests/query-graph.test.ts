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
 * Tests for the query_graph MCP tool — V11 Maestro Phase 2.
 * Three concerns:
 *   1. validateQueryGraphSql — schema + negative whitelist (Task 2.1)
 *   2. injectLimit          — LIMIT injection / cap (Task 2.2)
 *   3. executeQueryGraph    — prepare + iterate + audit log (Task 2.2 + 2.3)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  validateQueryGraphSql,
  injectLimit,
  executeQueryGraph,
} from "../mcp/tools/query-graph.js";

describe("query_graph validation — Task 2.1", () => {
  describe("SELECT-only enforcement", () => {
    it("accepts a basic SELECT", () => {
      const r = validateQueryGraphSql("SELECT * FROM nodes LIMIT 5");
      expect(r.ok).toBe(true);
    });

    it("accepts SELECT with leading whitespace and case-insensitive", () => {
      const r = validateQueryGraphSql("  select id from nodes");
      expect(r.ok).toBe(true);
    });

    it("rejects empty input", () => {
      const r = validateQueryGraphSql("");
      expect(r.ok).toBe(false);
    });

    it("rejects whitespace-only input", () => {
      const r = validateQueryGraphSql("   \n\t  ");
      expect(r.ok).toBe(false);
    });

    it("rejects non-SELECT first token", () => {
      const r = validateQueryGraphSql("DROP TABLE nodes");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/select/i);
    });
  });

  describe("forbidden keywords (negative whitelist)", () => {
    const forbidden = [
      "ATTACH",
      "DETACH",
      "PRAGMA",
      "UPDATE",
      "INSERT",
      "DELETE",
      "REPLACE",
      "DROP",
      "ALTER",
      "CREATE",
      "TRIGGER",
      "VACUUM",
      "REINDEX",
    ];
    for (const kw of forbidden) {
      it(`rejects ${kw} appearing anywhere`, () => {
        const r = validateQueryGraphSql(`SELECT * FROM nodes WHERE 1=1 /*${kw}*/`);
        expect(r.ok).toBe(false);
      });
    }

    it("rejects DROP even inside a CTE", () => {
      const r = validateQueryGraphSql("WITH x AS (DROP TABLE nodes) SELECT 1");
      expect(r.ok).toBe(false);
    });
  });

  describe("multi-statement rejection (semicolon outside strings)", () => {
    it("rejects SELECT 1; DROP TABLE nodes", () => {
      const r = validateQueryGraphSql("SELECT 1; DROP TABLE nodes");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/multi.statement|semicolon|statement/i);
    });

    it("accepts trailing whitespace-only semicolon", () => {
      const r = validateQueryGraphSql("SELECT 1;   ");
      expect(r.ok).toBe(true);
    });

    it("accepts semicolon inside a single-quoted string literal", () => {
      const r = validateQueryGraphSql("SELECT * FROM nodes WHERE title = 'a; b'");
      expect(r.ok).toBe(true);
    });

    it("rejects multiple statements separated by ;", () => {
      const r = validateQueryGraphSql("SELECT 1 ; SELECT 2");
      expect(r.ok).toBe(false);
    });
  });

  describe("schema introspection blocked", () => {
    it("rejects sqlite_master access", () => {
      const r = validateQueryGraphSql("SELECT name FROM sqlite_master");
      expect(r.ok).toBe(false);
    });

    it("rejects sqlite_schema access", () => {
      const r = validateQueryGraphSql("SELECT name FROM sqlite_schema");
      expect(r.ok).toBe(false);
    });

    it("rejects UNION with sqlite_master (UNION-based injection)", () => {
      const r = validateQueryGraphSql("SELECT id FROM nodes UNION SELECT name FROM sqlite_master");
      expect(r.ok).toBe(false);
    });
  });

  describe("comment-bypass attempts", () => {
    it("rejects DROP hidden in /* */", () => {
      const r = validateQueryGraphSql("SELECT * /* DROP TABLE nodes */ FROM nodes");
      expect(r.ok).toBe(false);
    });

    it("rejects DROP hidden in -- line comment", () => {
      const r = validateQueryGraphSql("SELECT 1 -- DROP TABLE nodes");
      expect(r.ok).toBe(false);
    });
  });
});

describe("query_graph injectLimit — Task 2.2", () => {
  it("injects LIMIT when missing", () => {
    const r = injectLimit("SELECT * FROM nodes", 100, 500);
    expect(r.sql.toUpperCase()).toMatch(/\bLIMIT 100\b/);
    expect(r.limitInjected).toBe(true);
  });

  it("does not inject when LIMIT already present", () => {
    const r = injectLimit("SELECT * FROM nodes LIMIT 5", 100, 500);
    expect(r.sql).toBe("SELECT * FROM nodes LIMIT 5");
    expect(r.limitInjected).toBe(false);
  });

  it("caps existing LIMIT > max", () => {
    const r = injectLimit("SELECT * FROM nodes LIMIT 9999", 100, 500);
    expect(r.sql).toMatch(/LIMIT 500/i);
    expect(r.limitInjected).toBe(false);
    expect(r.limitCapped).toBe(true);
  });

  it("strips trailing semicolon before injecting", () => {
    const r = injectLimit("SELECT * FROM nodes;", 100, 500);
    expect(r.sql).not.toMatch(/;\s*LIMIT/i);
    expect(r.sql).toMatch(/LIMIT 100$/);
  });
});

describe("query_graph execution + audit — Task 2.2 + 2.3", () => {
  let store: SqliteStore;
  let projectId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    const project = store.initProject("Test Project");
    projectId = project.id;
    // Seed some nodes so SELECT returns real rows.
    const db = store.getDb();
    db.prepare(
      `INSERT INTO nodes (id, project_id, type, title, status, created_at, updated_at)
       VALUES ('n1', ?, 'task', 'first', 'backlog', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).run(projectId);
    db.prepare(
      `INSERT INTO nodes (id, project_id, type, title, status, created_at, updated_at)
       VALUES ('n2', ?, 'task', 'second', 'done', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).run(projectId);
  });

  afterEach(() => {
    store.close();
  });

  it("returns rows for a valid SELECT", () => {
    const r = executeQueryGraph(store, { sql: "SELECT id, title FROM nodes ORDER BY id" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rowCount).toBe(2);
      expect(r.rows[0].id).toBe("n1");
      expect(r.auditId).toMatch(/^[a-f0-9-]{8,}$/);
    }
  });

  it("injects LIMIT 100 when absent", () => {
    const r = executeQueryGraph(store, { sql: "SELECT id FROM nodes" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.limitInjected).toBe(true);
  });

  it("returns truncated=true when result hits the cap", () => {
    const db = store.getDb();
    for (let i = 3; i <= 200; i++) {
      db.prepare(
        `INSERT INTO nodes (id, project_id, type, title, status, created_at, updated_at)
         VALUES (?, ?, 'task', 'n', 'backlog', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
      ).run(`bulk_${i}`, projectId);
    }
    const r = executeQueryGraph(store, { sql: "SELECT id FROM nodes", limit: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rowCount).toBe(50);
      expect(r.truncated).toBe(true);
    }
  });

  it("rejects DROP with a structured error and an auditId", () => {
    const r = executeQueryGraph(store, { sql: "DROP TABLE nodes" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.auditId).toMatch(/^[a-f0-9-]{8,}$/);
      expect(r.error).toBeTruthy();
    }
  });

  it("audits successful queries in tool_call_log", () => {
    const r = executeQueryGraph(store, { sql: "SELECT id FROM nodes LIMIT 5" });
    expect(r.ok).toBe(true);
    const log = store.getDb()
      .prepare("SELECT tool_name, tool_args FROM tool_call_log WHERE tool_name = 'query_graph' ORDER BY id DESC LIMIT 1")
      .get() as { tool_name: string; tool_args: string };
    expect(log).toBeDefined();
    expect(log.tool_name).toBe("query_graph");
    const args = JSON.parse(log.tool_args);
    expect(args.sql).toBe("SELECT id FROM nodes LIMIT 5");
    expect(args.rowCount).toBe(2);
    expect(args.rejected).toBeFalsy();
    expect(args.auditId).toBe(r.ok ? r.auditId : "");
  });

  it("audits rejected queries with rejected=true", () => {
    executeQueryGraph(store, { sql: "DROP TABLE nodes" });
    const log = store.getDb()
      .prepare("SELECT tool_args FROM tool_call_log WHERE tool_name = 'query_graph' ORDER BY id DESC LIMIT 1")
      .get() as { tool_args: string } | undefined;
    expect(log).toBeDefined();
    const args = JSON.parse(log!.tool_args);
    expect(args.rejected).toBe(true);
    expect(args.error).toBeTruthy();
  });

  it("supports bind params", () => {
    const r = executeQueryGraph(store, {
      sql: "SELECT id FROM nodes WHERE status = ?",
      params: ["done"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rowCount).toBe(1);
      expect(r.rows[0].id).toBe("n2");
    }
  });
});

describe("query_graph fuzz — Task 2.3 (≥12 injection vectors)", () => {
  let store: SqliteStore;
  let projectId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    const project = store.initProject("Fuzz Project");
    projectId = project.id;
    void projectId;
  });

  afterEach(() => {
    store.close();
  });

  const vectors: Array<[string, string]> = [
    ["UNION + sqlite_master",          "SELECT 1 UNION SELECT name FROM sqlite_master"],
    ["UNION + sqlite_schema",          "SELECT 1 UNION SELECT sql FROM sqlite_schema"],
    ["ATTACH database",                "ATTACH DATABASE 'foo.db' AS foo"],
    ["DETACH database",                "DETACH DATABASE foo"],
    ["PRAGMA introspection",           "PRAGMA table_info(nodes)"],
    ["multi-statement DROP",           "SELECT 1; DROP TABLE nodes"],
    ["block-comment hidden DROP",      "SELECT 1 /* DROP TABLE nodes */"],
    ["line-comment hidden DELETE",     "SELECT 1 -- DELETE FROM nodes"],
    ["INSERT after SELECT semicolon",  "SELECT 1; INSERT INTO nodes VALUES('x','y','z','t','s','c','u')"],
    ["UPDATE keyword anywhere",        "SELECT * FROM nodes WHERE x=1 OR UPDATE='y'"],
    ["nested CTE with INSERT",         "WITH cte AS (SELECT 1) INSERT INTO nodes SELECT * FROM cte"],
    ["CREATE TABLE attempt",           "CREATE TABLE evil AS SELECT * FROM nodes"],
    ["VACUUM",                         "VACUUM"],
    ["REINDEX",                        "REINDEX nodes"],
    ["TRIGGER creation",               "SELECT 1; CREATE TRIGGER t AFTER INSERT ON nodes BEGIN END"],
  ];

  for (const [label, sql] of vectors) {
    it(`rejects: ${label}`, () => {
      const r = executeQueryGraph(store, { sql });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toBeTruthy();
        expect(r.auditId).toBeTruthy();
      }
    });
  }

  it("logs every rejected fuzz attempt to tool_call_log", () => {
    for (const [, sql] of vectors) {
      executeQueryGraph(store, { sql });
    }
    const count = store.getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM tool_call_log
         WHERE tool_name = 'query_graph' AND tool_args LIKE '%"rejected":true%'`,
      )
      .get() as { n: number };
    expect(count.n).toBe(vectors.length);
  });
});
