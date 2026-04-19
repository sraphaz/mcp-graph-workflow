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
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";

describe("CLI import", () => {
  let tmpDir: string;
  let prdFile: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `cli-import-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    prdFile = path.join(tmpDir, "test.md");
    writeFileSync(prdFile, `# Test PRD

## Epic: Authentication

### Task: Login page
- Priority: high
- Build login form with email/password

### Task: OAuth integration
- Priority: medium
- Add Google OAuth support
`);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should import a PRD file and create nodes", () => {
    const output = execSync(`npx tsx src/cli/index.ts import "${prdFile}" -d "${tmpDir}"`, {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    expect(output).toContain("Imported:");
    expect(output).toContain("nodes");

    // Verify nodes were created in the store
    const store = SqliteStore.open(tmpDir);
    const stats = store.getStats();
    expect(stats.totalNodes).toBeGreaterThan(0);
    store.close();
  });
});
