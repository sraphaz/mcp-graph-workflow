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
 * B17 (P0): doctor must NOT report a 0-byte graph.db as healthy.
 *   better-sqlite3 happily opens an empty file as a fresh DB and
 *   PRAGMA integrity_check returns 'ok' on it — masking corruption /
 *   incomplete writes / interrupted init.
 *   Source: notebook node_aa136f814cfe.
 *
 * B18 (P1): doctor write-permissions must distinguish 'directory does not
 *   exist' from 'exists but read-only'. Today both surface as
 *   'No write access to <path>' which sends users debugging chmod when
 *   the path is just wrong.
 *   Source: notebook node_841f0b641e2a.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./repro.js";

interface DoctorCheck {
  name: string;
  level: "ok" | "warning" | "error";
  message: string;
  suggestion?: string;
}

interface DoctorReport {
  passed: boolean;
  checks: DoctorCheck[];
}

function findCheck(report: DoctorReport, name: string): DoctorCheck {
  const c = report.checks.find((x) => x.name === name);
  if (!c) throw new Error(`check '${name}' not found in doctor report`);
  return c;
}

describe("B17 — doctor flags 0-byte graph.db as unhealthy", () => {
  it("sqlite-database check returns level=error on empty graph.db", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b17-"));
    try {
      mkdirSync(join(dir, "workflow-graph"));
      writeFileSync(join(dir, "workflow-graph", "graph.db"), "");

      const result = runCli(["doctor", "--json"], { cwd: dir });
      const report = JSON.parse(result.stdout) as DoctorReport;

      const sqlite = findCheck(report, "sqlite-database");
      expect(sqlite.level).toBe("error");
      expect(sqlite.message.toLowerCase()).toMatch(/empty|uninitialized|no schema/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("db-integrity check does not return ok on empty graph.db", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b17-int-"));
    try {
      mkdirSync(join(dir, "workflow-graph"));
      writeFileSync(join(dir, "workflow-graph", "graph.db"), "");

      const result = runCli(["doctor", "--json"], { cwd: dir });
      const report = JSON.parse(result.stdout) as DoctorReport;

      const integ = findCheck(report, "db-integrity");
      expect(integ.level).not.toBe("ok");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("after 'mcp-graph init', sqlite-database and db-integrity both return ok", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b17-init-"));
    try {
      runCli(["init"], { cwd: dir });
      const result = runCli(["doctor", "--json"], { cwd: dir });
      const report = JSON.parse(result.stdout) as DoctorReport;

      expect(findCheck(report, "sqlite-database").level).toBe("ok");
      expect(findCheck(report, "db-integrity").level).toBe("ok");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("B18 — doctor distinguishes nonexistent dir from read-only dir", () => {
  it("write-permissions message says 'does not exist' when --dir is missing", () => {
    const ghost = join(tmpdir(), `mcpg-b18-ghost-${process.pid}-${Date.now()}`);
    const result = runCli(["doctor", "--json", "--dir", ghost]);
    const report = JSON.parse(result.stdout) as DoctorReport;

    const wp = findCheck(report, "write-permissions");
    expect(wp.level).toBe("error");
    expect(wp.message.toLowerCase()).toContain("does not exist");
  });
});
