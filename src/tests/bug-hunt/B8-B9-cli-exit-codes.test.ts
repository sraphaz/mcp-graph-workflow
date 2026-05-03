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
 * B8 + B9: CLI must exit non-zero on real failures so CI/scripts can
 * detect them.
 *
 * B8 (node_a1881a2e4426): mcp-graph import <missing> previously exited 0
 *   even after [ERROR] Import failed: ENOENT. Fix shipped via try/catch in
 *   src/cli/commands/import-cmd.ts that calls process.exit(1) on failure.
 *
 * B9 (node_f32533817cd0): mcp-graph <unknown-command> previously exited 0.
 *   Commander.js' default behavior already calls process.exit(1) when an
 *   unknown subcommand is invoked.
 *
 * Both were initially flagged from `cmd | tail -3 ; echo $?` reading tail's
 * status, not the CLI's. The new repro helper isolates exit code, stdout,
 * stderr so we never hit that false-positive again (see repro.ts header).
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./repro.js";

describe("B8 — import on missing file exits 1", () => {
  it("exits 1 with ENOENT in stderr when target file does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b8-"));
    try {
      const result = runCli(["import", "/tmp/does-not-exist-mcpg-b8.md"], { cwd: dir });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Import failed");
      expect(result.stderr).toContain("ENOENT");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("B9 — unknown command exits non-zero", () => {
  it("exits non-zero with 'unknown command' in stderr", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b9-"));
    try {
      const result = runCli(["nonexistent-subcommand"], { cwd: dir });
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("unknown command");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
