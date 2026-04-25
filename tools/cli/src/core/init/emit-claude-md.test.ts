/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitClaudeMd } from "./emit-claude-md.js";

describe("emitClaudeMd (Sprint 7.4 #7.4.7)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-claude-md-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("creates CLAUDE.md when missing", () => {
    const change = emitClaudeMd(tmp);
    expect(change.action).toBe("created");
    expect(change.bytes).toBeGreaterThan(0);
    expect(existsSync(join(tmp, "CLAUDE.md"))).toBe(true);
  });

  it("template content covers the required surface", () => {
    emitClaudeMd(tmp);
    const body = readFileSync(join(tmp, "CLAUDE.md"), "utf8");
    // mg <cmd> workflow
    expect(body).toContain("`mg next`");
    expect(body).toContain("`mg start <id>`");
    expect(body).toContain("`mg finish <id>`");
    // Auto-fired hooks
    expect(body).toContain("mg hooks install");
    expect(body).toContain("PreToolUse");
    expect(body).toContain("SessionStart");
    // Provenance + redact-test
    expect(body).toContain("mg log --redact-test");
  });

  it("template stays under the 80-line ceiling", () => {
    emitClaudeMd(tmp);
    const body = readFileSync(join(tmp, "CLAUDE.md"), "utf8");
    const lineCount = body.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(80);
  });

  it("is idempotent — never overwrites an existing CLAUDE.md", () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "user content here\n", "utf8");
    const change = emitClaudeMd(tmp);
    expect(change.action).toBe("skipped-existing");
    expect(readFileSync(join(tmp, "CLAUDE.md"), "utf8")).toBe("user content here\n");
  });
});
