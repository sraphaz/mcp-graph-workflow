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
 * B11 (P0): mcp-graph stats em DB corrompida deve emitir mensagem amigável
 * e exit 1 — não vazar SqliteError stack trace nem retornar exit 0.
 *
 * Repro: echo garbage > workflow-graph/graph.db && mcp-graph stats
 * Antes do fix: better-sqlite3 SqliteError "file is not a database" cru, exit 0.
 * Depois do fix: stderr contém "Database corrupt", exit 1, sem stack trace.
 *
 * Fix shipped in batch 1 (8ced33c2) via src/cli/open-store.ts —
 * SqliteStore.open wrapped in try/catch detectando SQLITE_NOTADB/SQLITE_CORRUPT.
 *
 * Source: mcp-graph notebook node_57264fd72793.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./repro.js";

describe("B11 — stats on corrupt DB exits 1 with friendly error", () => {
  it("returns exit 1 and 'Database corrupt' message, no stack trace", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b11-"));
    try {
      mkdirSync(join(dir, "workflow-graph"));
      writeFileSync(join(dir, "workflow-graph", "graph.db"), "not a sqlite file at all\n");

      const result = runCli(["stats"], { cwd: dir });

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Database corrupt");
      expect(result.stderr).not.toContain("at SqliteStore");
      expect(result.stderr).not.toContain("better_sqlite3.node");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("--json on corrupt DB still exits 1 (no stdout JSON emitted)", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b11-json-"));
    try {
      mkdirSync(join(dir, "workflow-graph"));
      writeFileSync(join(dir, "workflow-graph", "graph.db"), "garbage");

      const result = runCli(["stats", "--json"], { cwd: dir });

      expect(result.code).toBe(1);
      expect(result.stdout.trim()).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
