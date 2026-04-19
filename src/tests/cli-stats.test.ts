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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";

describe("CLI stats", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `cli-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const store = SqliteStore.open(tmpDir);
    store.initProject("CLI Test");
    store.insertNode(makeNode({ status: "done" }));
    store.insertNode(makeNode({ status: "backlog" }));
    store.close();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should display stats in text format", () => {
    const output = execSync(`npx tsx src/cli/index.ts stats -d "${tmpDir}"`, {
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    expect(output).toContain("Project: CLI Test");
    expect(output).toContain("Total nodes: 2");
  });

  it("should display stats in JSON format", () => {
    const output = execSync(`npx tsx src/cli/index.ts stats -d "${tmpDir}" --json`, {
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    const json = JSON.parse(output);
    expect(json.project).toBe("CLI Test");
    expect(json.totalNodes).toBe(2);
    expect(json.byStatus.done).toBe(1);
    expect(json.byStatus.backlog).toBe(1);
  });
});
