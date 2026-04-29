/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-10.T01 — Tests for .claude/hooks/block-dangerous-git.sh
 * Runs the script via child_process and verifies exit codes per command.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const HOOK_PATH = join(process.cwd(), ".claude/hooks/block-dangerous-git.sh");

function runHook(command: string): { code: number; stderr: string } {
  const payload = JSON.stringify({ tool_input: { command } });
  const r = spawnSync("bash", [HOOK_PATH], {
    input: payload,
    encoding: "utf-8",
  });
  return {
    code: r.status ?? -1,
    stderr: r.stderr ?? "",
  };
}

describe("block-dangerous-git.sh (E10.T01)", () => {
  it("hook script exists at expected path", () => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it("blocks 'git push --force' with exit 2", () => {
    const r = runHook("git push --force origin main");
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("BLOCKED");
  });

  it("blocks 'git push -f' with exit 2", () => {
    const r = runHook("git push -f origin main");
    expect(r.code).toBe(2);
  });

  it("blocks 'git reset --hard' with exit 2", () => {
    const r = runHook("git reset --hard HEAD~1");
    expect(r.code).toBe(2);
  });

  it("blocks 'git clean -f' with exit 2", () => {
    const r = runHook("git clean -fd");
    expect(r.code).toBe(2);
  });

  it("blocks 'git branch -D' with exit 2", () => {
    const r = runHook("git branch -D feature/old");
    expect(r.code).toBe(2);
  });

  it("blocks 'git checkout .' (discard local) with exit 2", () => {
    const r = runHook("git checkout .");
    expect(r.code).toBe(2);
  });

  it("blocks 'git restore .' (discard local) with exit 2", () => {
    const r = runHook("git restore .");
    expect(r.code).toBe(2);
  });

  it("blocks bare 'git push' (without --dry-run) with exit 2", () => {
    const r = runHook("git push origin main");
    expect(r.code).toBe(2);
  });

  it("allows 'git push --dry-run' (exit 0)", () => {
    const r = runHook("git push --dry-run origin main");
    expect(r.code).toBe(0);
  });

  it("allows 'git status' (exit 0)", () => {
    const r = runHook("git status");
    expect(r.code).toBe(0);
  });

  it("allows 'git add file.ts' (exit 0)", () => {
    const r = runHook("git add src/foo.ts");
    expect(r.code).toBe(0);
  });

  it("allows 'git commit -m msg' (exit 0)", () => {
    const r = runHook("git commit -m 'feat: thing'");
    expect(r.code).toBe(0);
  });

  it("returns exit 0 when input has no command", () => {
    const r = spawnSync("bash", [HOOK_PATH], {
      input: "{}",
      encoding: "utf-8",
    });
    expect(r.status).toBe(0);
  });

  it("returns exit 0 on malformed JSON (graceful)", () => {
    const r = spawnSync("bash", [HOOK_PATH], {
      input: "not json",
      encoding: "utf-8",
    });
    expect(r.status).toBe(0);
  });
});
