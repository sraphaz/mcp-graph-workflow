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
 * B14 (P1): mcp-graph import deve recusar re-import do mesmo arquivo sem
 * --force. Antes do fix, cada import duplicava nodes (CI loop ou double-invoke
 * acidental dobrava o grafo silenciosamente).
 *
 * Repro: import file.md && import file.md
 * Antes: 2x "Imported: 2 nodes, 2 edges"; stats mostra 4 nodes em vez de 2.
 * Depois: 2nd import → exit 1, stderr "Source already imported"; --force overrides.
 *
 * Source: mcp-graph notebook node_6b7d86d7238a.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./repro.js";

function setupProject(): { dir: string; prdPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "mcpg-b14-"));
  runCli(["init"], { cwd: dir });
  const prdPath = join(dir, "sample-prd.md");
  writeFileSync(prdPath, "# Sample\n\n## Goal\nTest idempotent import.\n", "utf-8");
  return { dir, prdPath };
}

describe("B14 — import refuses duplicate without --force", () => {
  it("first import succeeds with exit 0", () => {
    const { dir, prdPath } = setupProject();
    try {
      const r = runCli(["import", prdPath], { cwd: dir });
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("Imported:");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("second import of same file exits 1 with friendly message", () => {
    const { dir, prdPath } = setupProject();
    try {
      runCli(["import", prdPath], { cwd: dir });
      const r = runCli(["import", prdPath], { cwd: dir });
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("Source already imported");
      expect(r.stderr).toContain("--force");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("--force re-imports and creates duplicate nodes (opt-in)", () => {
    const { dir, prdPath } = setupProject();
    try {
      runCli(["import", prdPath], { cwd: dir });
      const r = runCli(["import", "--force", prdPath], { cwd: dir });
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("Imported:");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
