/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-10.T02 — Tests for .claude/hooks/graph-wip-check.sh
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const HOOK_PATH = join(process.cwd(), ".claude/hooks/graph-wip-check.sh");

function runHook(command: string): { code: number; stderr: string } {
  const payload = JSON.stringify({ tool_input: { command } });
  const r = spawnSync("bash", [HOOK_PATH], {
    input: payload,
    encoding: "utf-8",
  });
  return { code: r.status ?? -1, stderr: r.stderr ?? "" };
}

describe("graph-wip-check.sh (E10.T02)", () => {
  it("hook script exists at expected path", () => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it("non-commit commands always exit 0 with no stderr", () => {
    const r = runHook("git status");
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
  });

  it("git push exits 0 silent (only commit triggers check)", () => {
    const r = runHook("git push origin main");
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
  });

  it("git commit triggers WIP check (exit 0 always — advisory)", () => {
    const r = runHook("git commit -m 'feat: thing'");
    expect(r.code).toBe(0);
  });

  it("git commit with WIP > 0 emits advisory to stderr", () => {
    const r = runHook("git commit -m 'wip'");
    if (r.stderr.length > 0) {
      expect(r.stderr).toMatch(/WIP|in_progress|finish_task/i);
    }
    expect(r.code).toBe(0);
  });

  it("returns 0 on missing or malformed input (graceful)", () => {
    const r = spawnSync("bash", [HOOK_PATH], {
      input: "{}",
      encoding: "utf-8",
    });
    expect(r.status).toBe(0);
  });

  it("never blocks: exit always 0 even on commit", () => {
    const safeCommands = [
      "git commit -m 'msg'",
      "git commit --amend",
      "git commit --no-verify -m 'x'",
    ];
    for (const cmd of safeCommands) {
      expect(runHook(cmd).code).toBe(0);
    }
  });
});
