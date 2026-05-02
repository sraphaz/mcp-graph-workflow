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
 * B12+B13 (P2): mcp-graph import deve sinalizar quando um arquivo não-vazio
 * produz 0 nodes. Antes do fix, "Imported: 0 nodes" + exit 0 escondia que o
 * arquivo era binário ou que o parser não soube ler.
 *
 * Repro:
 *   touch /tmp/empty.md  →  exit 0 (silent passthrough — file size 0)
 *   head -c 4096 /dev/urandom > /tmp/bin.md && import /tmp/bin.md  →  exit 1
 *   import --allow-empty /tmp/bin.md  →  exit 0 (opt-in)
 *
 * Source: mcp-graph notebook node_bc09db1f30f6.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./repro.js";

function freshProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "mcpg-b12-"));
  runCli(["init"], { cwd: dir });
  return dir;
}

describe("B12+B13 — import surfaces empty/garbage files", () => {
  it("empty file passes through with exit 0 (no signal needed)", () => {
    const dir = freshProject();
    const filePath = join(dir, "empty.md");
    writeFileSync(filePath, "", "utf-8");
    try {
      const r = runCli(["import", filePath], { cwd: dir });
      expect(r.code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("non-empty file that yields 0 entities exits 1 with hint", () => {
    const dir = freshProject();
    const filePath = join(dir, "garbage.md");
    // Random bytes that the markdown parser cannot map to any entity.
    writeFileSync(filePath, "\x00\x01\x02\x03\x04\x05".repeat(500), "utf-8");
    try {
      const r = runCli(["import", filePath], { cwd: dir });
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("No entities extracted");
      expect(r.stderr).toContain("--allow-empty");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("--allow-empty makes the same garbage file exit 0", () => {
    const dir = freshProject();
    const filePath = join(dir, "garbage.md");
    writeFileSync(filePath, "\x00\x01\x02\x03\x04\x05".repeat(500), "utf-8");
    try {
      const r = runCli(["import", "--allow-empty", filePath], { cwd: dir });
      expect(r.code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
