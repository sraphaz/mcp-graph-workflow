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
 * B19 (P2 cosmetic): doctor message when graph.db is a directory must
 *   say so, not "disk I/O error". Source: notebook node_22feb42001a1.
 *
 * B23 (P0): malformed JSON in mcp-graph.config.json must FAIL loadConfig,
 *   not silently fall through to defaults. Source: notebook node_873b627dab19.
 *
 * B24 (P1): UTF-8 BOM-prefixed JSON config must parse successfully —
 *   common with editors that save with BOM. Source: notebook node_53b5f5463bf5.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./repro.js";
import { loadConfig } from "../../core/config/config-loader.js";

interface DoctorCheck {
  name: string;
  level: "ok" | "warning" | "error";
  message: string;
}

interface DoctorReport {
  passed: boolean;
  checks: DoctorCheck[];
}

describe("B19 — doctor explains when graph.db is a directory", () => {
  it("sqlite-database message names the actual problem (directory) not 'disk I/O'", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b19-"));
    try {
      mkdirSync(join(dir, "workflow-graph", "graph.db"), { recursive: true });
      const result = runCli(["doctor", "--json"], { cwd: dir });
      const report = JSON.parse(result.stdout) as DoctorReport;
      const sqlite = report.checks.find((c) => c.name === "sqlite-database");
      expect(sqlite).toBeDefined();
      expect(sqlite!.level).toBe("error");
      expect(sqlite!.message.toLowerCase()).toContain("directory");
      expect(sqlite!.message.toLowerCase()).not.toContain("disk i/o");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("B23 — loadConfig refuses malformed JSON", () => {
  it("throws when config file is invalid JSON (does not silently use defaults)", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b23-"));
    try {
      writeFileSync(join(dir, "mcp-graph.config.json"), "not json at all");
      expect(() => loadConfig(dir)).toThrow(/invalid config|invalid json/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("succeeds on valid JSON (no regression)", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b23-ok-"));
    try {
      writeFileSync(join(dir, "mcp-graph.config.json"), '{"port": 3007}');
      const cfg = loadConfig(dir);
      expect(cfg.port).toBe(3007);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("B24 — loadConfig tolerates UTF-8 BOM prefix", () => {
  it("parses BOM-prefixed JSON without error", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b24-"));
    try {
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const body = Buffer.from('{"port": 3009}', "utf-8");
      writeFileSync(join(dir, "mcp-graph.config.json"), Buffer.concat([bom, body]));
      const cfg = loadConfig(dir);
      expect(cfg.port).toBe(3009);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
