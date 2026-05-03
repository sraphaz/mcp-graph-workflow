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
 * B16 (P0): mcp-graph doctor must exit 1 when checks fail, and --json
 * stdout must be parseable (logger lines must NOT contaminate stdout).
 *
 * Repro 1: doctor with errors printed "Some critical checks failed" but $? == 0.
 *   CI never noticed env breakage. Fixed in src/cli/commands/doctor.ts:74-76.
 * Repro 2: `doctor --json | jq` failed because [INFO]/[WARN] logger lines
 *   appeared next to JSON. Fixed by writing logger to stderr only
 *   (src/core/utils/logger.ts:71-73 writeStderr) so stdout stays clean JSON.
 *
 * Source: mcp-graph notebook node_90ac4401a376.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./repro.js";

describe("B16 — doctor exit code + clean JSON stdout", () => {
  it("--json stdout is parseable JSON with no logger lines mixed in", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b16-json-"));
    try {
      const result = runCli(["doctor", "--json"], { cwd: dir });

      expect(result.stdout).not.toContain("[INFO]");
      expect(result.stdout).not.toContain("[WARN]");
      expect(result.stdout).not.toContain("[ERROR]");

      const parsed = JSON.parse(result.stdout) as { passed: boolean; checks: unknown[] };
      expect(Array.isArray(parsed.checks)).toBe(true);
      expect(typeof parsed.passed).toBe("boolean");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits non-zero when at least one check fails", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b16-exit-"));
    try {
      const result = runCli(["doctor", "--json"], { cwd: dir });
      const report = JSON.parse(result.stdout) as { passed: boolean };
      if (report.passed) {
        expect(result.code).toBe(0);
      } else {
        expect(result.code).toBe(1);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("text mode also exits 1 when checks fail and prints the failure summary", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b16-text-"));
    try {
      const result = runCli(["doctor"], { cwd: dir });
      if (result.code === 1) {
        expect(result.stdout).toContain("Some critical checks failed");
      } else {
        expect(result.code).toBe(0);
        expect(result.stdout).toContain("All critical checks passed");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
