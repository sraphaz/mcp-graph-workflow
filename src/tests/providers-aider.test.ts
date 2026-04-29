/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aiderAliases, importAiderSettings, installAiderBridge } from "../core/hooks/providers/aider.js";

describe("providers/aider.ts — yaml reader", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-aider-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("maps lint-cmd / test-cmd to mcp-graph channels", () => {
    expect(aiderAliases["lint-cmd"]).toBe("tool:post-call");
    expect(aiderAliases["test-cmd"]).toBe("task:post-complete");
  });

  it("imports a single string lint-cmd", () => {
    const path = join(tmp, ".aider.conf.yml");
    writeFileSync(path, `lint-cmd: "npm run lint"\n`);
    const env = importAiderSettings({ source: path });
    expect(env.imported).toHaveLength(1);
    expect(env.imported[0].agentSource).toBe("aider");
    expect(env.imported[0].channel).toBe("tool:post-call");
    expect(env.imported[0].timeoutMs).toBe(30_000);
    expect(env.imported[0].commandArgs).toEqual(["-c", "npm run lint"]);
  });

  it("imports an array of test-cmd values", () => {
    const path = join(tmp, ".aider.conf.yml");
    writeFileSync(path, `test-cmd:\n  - "npm test"\n  - "npm run test:e2e"\n`);
    const env = importAiderSettings({ source: path });
    expect(env.imported).toHaveLength(2);
    expect(env.imported.every((h) => h.channel === "task:post-complete")).toBe(true);
  });

  it("notes auto-commits in skipped (handled separately by git-hook bridge)", () => {
    const path = join(tmp, ".aider.conf.yml");
    writeFileSync(path, `auto-commits: true\n`);
    const env = importAiderSettings({ source: path });
    expect(env.imported).toHaveLength(0);
    expect(env.skipped[0].event).toBe("auto-commits");
  });

  it("returns empty + skip reason when source missing", () => {
    const env = importAiderSettings({ source: join(tmp, "nope.yml") });
    expect(env.imported).toEqual([]);
    expect(env.skipped[0].reason).toMatch(/not found/);
  });
});

describe("providers/aider.ts — installAiderBridge git-hook generator", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mcp-aider-bridge-"));
    mkdirSync(join(tmp, ".git"), { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("dry-run does not write any file", () => {
    const result = installAiderBridge({ basePath: tmp });
    expect(result.dryRun).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(existsSync(join(tmp, ".git", "hooks", "pre-commit"))).toBe(false);
  });

  it("apply=true creates fresh hook scripts and chmods them", () => {
    const result = installAiderBridge({ basePath: tmp, apply: true });
    expect(result.applied).toBe(true);
    const path = join(tmp, ".git", "hooks", "pre-commit");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toMatch(/mcp-graph hook fire/);
    expect(content).toMatch(/^#!\/bin\/sh/);
  });

  it("apply=true with existing hook backs up to .bak and chains the snippet", () => {
    const path = join(tmp, ".git", "hooks", "pre-commit");
    mkdirSync(join(tmp, ".git", "hooks"), { recursive: true });
    writeFileSync(path, "#!/bin/sh\necho 'user-hook'\n");
    const result = installAiderBridge({ basePath: tmp, apply: true });
    const backup = result.changes.find((c) => c.hookPath === path)?.backupPath;
    expect(backup).toBeDefined();
    if (backup) {
      expect(existsSync(backup)).toBe(true);
      expect(readFileSync(backup, "utf-8")).toContain("user-hook");
    }
    const newContent = readFileSync(path, "utf-8");
    expect(newContent).toContain("user-hook");
    expect(newContent).toContain("mcp-graph hook fire");
  });

  it("idempotent — second apply detects marker and skips", () => {
    installAiderBridge({ basePath: tmp, apply: true });
    const second = installAiderBridge({ basePath: tmp, apply: true });
    expect(second.changes.every((c) => c.action === "skip-already-installed")).toBe(true);
  });

  it("no-git: returns empty changes list", () => {
    const noGit = mkdtempSync(join(tmpdir(), "mcp-aider-no-git-"));
    try {
      const result = installAiderBridge({ basePath: noGit });
      expect(result.changes).toEqual([]);
    } finally {
      rmSync(noGit, { recursive: true, force: true });
    }
  });
});
