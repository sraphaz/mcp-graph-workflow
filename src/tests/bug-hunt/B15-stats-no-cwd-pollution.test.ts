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
 * B15 (P0): mcp-graph stats em dir sem projeto NÃO deve criar workflow-graph/.
 *
 * Repro: cd /tmp/empty && mcp-graph stats
 * Antes do fix: silently mkdir workflow-graph/ + criava graph.db (file pollution),
 * loga "Stats failed: Graph not initialized", exit 1.
 * Depois do fix: imprime "No mcp-graph project at <dir>. Run 'mcp-graph init'...",
 * exit 1, NENHUM arquivo criado em cwd.
 *
 * Source: mcp-graph notebook node_1cfe2d825862.
 */

import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./repro.js";

describe("B15 — stats does not pollute cwd with workflow-graph/", () => {
  it("stats in empty dir exits 1 without creating workflow-graph/", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b15-"));
    try {
      const result = runCli(["stats"], { cwd: dir });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("No mcp-graph project");
      expect(existsSync(join(dir, "workflow-graph"))).toBe(false);
      expect(existsSync(join(dir, "workflow-graph", "graph.db"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stats after init succeeds with exit 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b15-init-"));
    try {
      const initResult = runCli(["init"], { cwd: dir });
      expect(initResult.code).toBe(0);
      expect(existsSync(join(dir, "workflow-graph", "graph.db"))).toBe(true);

      const statsResult = runCli(["stats"], { cwd: dir });
      expect(statsResult.code).toBe(0);
      expect(statsResult.stdout).toContain("Total nodes:");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
