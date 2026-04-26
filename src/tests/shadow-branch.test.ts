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

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import {
  createShadowBranch,
  mergeShadowBranch,
  discardShadowBranch,
  getShadowBranchName,
  pruneOrphanWorktrees,
} from "../core/autonomy/shadow-branch.js";
import { execSync } from "node:child_process";

const calls = () => vi.mocked(execSync).mock.calls.map((c) => String(c[0]));

describe("shadow-branch (worktree-based)", () => {
  afterEach(() => { vi.clearAllMocks(); });

  describe("getShadowBranchName", () => {
    it("generates ai-shadow/{nodeId}-{ts} name", () => {
      expect(getShadowBranchName("node_abc123")).toMatch(/^ai-shadow\/node_abc123-\d+$/);
    });

    it("falls back to 'unknown' when nodeId is empty (defensive)", () => {
      expect(getShadowBranchName("")).toMatch(/^ai-shadow\/unknown-\d+$/);
    });
  });

  describe("createShadowBranch", () => {
    it("creates a worktree with a dedicated branch (no plain checkout -b)", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      const result = createShadowBranch("node_42");

      expect(result.created).toBe(true);
      expect(result.branchName).toMatch(/^ai-shadow\/node_42-\d+$/);
      expect(result.worktreePath).toBeDefined();
      expect(result.worktreePath).toMatch(/mcpg-wt-node_42-\d+$/);

      // Critical: uses worktree, not a checkout that would switch the agent's shell
      const cmd = calls()[0];
      expect(cmd).toContain("git worktree add -b ai-shadow/node_42-");
      expect(cmd).toContain(result.worktreePath!);
      expect(cmd).toContain("HEAD");
      expect(cmd).not.toContain("checkout -b");
    });

    it("returns error info when git fails", () => {
      vi.mocked(execSync).mockImplementation(() => { throw new Error("fatal: not a git repo"); });
      const result = createShadowBranch("node_42");
      expect(result.created).toBe(false);
      expect(result.error).toContain("not a git repo");
    });

    it("rejects empty nodeId without invoking git", () => {
      const result = createShadowBranch("");
      expect(result.created).toBe(false);
      expect(result.error).toMatch(/required/i);
      expect(execSync).not.toHaveBeenCalled();
    });
  });

  describe("mergeShadowBranch", () => {
    it("ff-merges, removes the worktree, then deletes the branch (full handle)", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      const handle = { branchName: "ai-shadow/node_42-1", worktreePath: "/tmp/mcpg-wt-node_42-1" };
      const r = mergeShadowBranch(handle, "main");

      expect(r.merged).toBe(true);
      expect(r.worktreePath).toBe("/tmp/mcpg-wt-node_42-1");
      const c = calls();
      expect(c.some((x) => x.includes("git checkout main"))).toBe(true);
      expect(c.some((x) => x.includes("git merge ai-shadow/node_42-1 --ff-only"))).toBe(true);
      expect(c.some((x) => x.includes("git worktree remove /tmp/mcpg-wt-node_42-1"))).toBe(true);
      expect(c.some((x) => x.includes("git branch -D ai-shadow/node_42-1"))).toBe(true);
    });

    it("backward-compat: accepts the legacy string form (no worktree to remove)", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      const r = mergeShadowBranch("ai-shadow/node_legacy-1", "main");

      expect(r.merged).toBe(true);
      const c = calls();
      // No worktree remove call when no path was provided
      expect(c.some((x) => x.includes("git worktree remove"))).toBe(false);
      expect(c.some((x) => x.includes("git branch -D"))).toBe(true);
    });

    it("skips the checkout when targetBranch is HEAD (already there)", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      mergeShadowBranch({ branchName: "ai-shadow/x-1", worktreePath: "/tmp/wt" }, "HEAD");
      expect(calls().some((c) => c.includes("git checkout HEAD"))).toBe(false);
    });

    it("returns error when ff-merge fails (e.g. divergent history)", () => {
      let i = 0;
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (String(cmd).includes("merge")) throw new Error("Not possible to fast-forward");
        return Buffer.from(`out${i++}`);
      });
      const r = mergeShadowBranch({ branchName: "ai-shadow/x-1", worktreePath: "/tmp/wt" }, "main");
      expect(r.merged).toBe(false);
      expect(r.error).toContain("fast-forward");
    });

    it("worktree-remove failure is non-fatal — branch still gets deleted", () => {
      let attempt = 0;
      vi.mocked(execSync).mockImplementation((cmd) => {
        attempt++;
        if (String(cmd).includes("worktree remove")) {
          throw new Error("worktree directory missing");
        }
        return Buffer.from("");
      });
      const r = mergeShadowBranch(
        { branchName: "ai-shadow/x-1", worktreePath: "/tmp/wt-gone" },
        "main",
      );
      expect(r.merged).toBe(true);
      // branch -D was attempted after the soft worktree-remove failure
      expect(calls().some((c) => c.includes("git branch -D ai-shadow/x-1"))).toBe(true);
      void attempt;
    });
  });

  describe("discardShadowBranch", () => {
    it("force-removes the worktree and deletes the branch (full handle)", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      const r = discardShadowBranch(
        { branchName: "ai-shadow/x-1", worktreePath: "/tmp/wt" },
        "main",
      );
      expect(r.discarded).toBe(true);
      const c = calls();
      expect(c.some((x) => x.includes("git worktree remove --force /tmp/wt"))).toBe(true);
      expect(c.some((x) => x.includes("git branch -D ai-shadow/x-1"))).toBe(true);
      // Critically: NO checkout — never switches the agent's shell branch
      expect(c.some((x) => x.includes("git checkout main"))).toBe(false);
    });

    it("backward-compat: legacy string falls back to checkout + branch -D", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      const r = discardShadowBranch("ai-shadow/legacy-1", "main");
      expect(r.discarded).toBe(true);
      const c = calls();
      expect(c.some((x) => x.includes("git checkout main"))).toBe(true);
      expect(c.some((x) => x.includes("git branch -D ai-shadow/legacy-1"))).toBe(true);
    });

    it("worktree-remove --force failure is non-fatal", () => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (String(cmd).includes("worktree remove")) throw new Error("ENOENT");
        return Buffer.from("");
      });
      const r = discardShadowBranch(
        { branchName: "ai-shadow/x-1", worktreePath: "/tmp/wt-gone" },
        "main",
      );
      expect(r.discarded).toBe(true);
    });
  });

  describe("pruneOrphanWorktrees", () => {
    it("invokes git worktree prune --verbose at the end", () => {
      // No ai-shadow branches → only the final prune call runs.
      vi.mocked(execSync).mockImplementation((cmd: unknown) => {
        if (String(cmd).includes("for-each-ref")) return Buffer.from("");
        return Buffer.from("Removing worktrees/wt-orphan: gitdir gone");
      });
      const r = pruneOrphanWorktrees();
      expect(r.pruned).toBe(true);
      expect(r.reapedBranches).toBe(0);
      expect(r.reapedWorktrees).toBe(0);
      const allCmds = calls().join("\n");
      expect(allCmds).toContain("git worktree prune --verbose");
    });

    it("never throws even when git fails", () => {
      vi.mocked(execSync).mockImplementation(() => { throw new Error("not a git repo"); });
      const r = pruneOrphanWorktrees();
      expect(r.pruned).toBe(false);
      expect(r.error).toContain("not a git repo");
    });

    it("reaps branches whose timestamp suffix is older than ttlMs", () => {
      const now = Date.now();
      const oldTs = now - 2 * 60 * 60 * 1000; // 2h ago
      const freshTs = now - 5 * 60 * 1000;    // 5m ago
      const wtPath = "/tmp/mcpg-wt-stale-" + oldTs;

      vi.mocked(execSync).mockImplementation((cmd: unknown) => {
        const c = String(cmd);
        if (c.includes("for-each-ref")) {
          return Buffer.from(`ai-shadow/stale-${oldTs}\nai-shadow/fresh-${freshTs}\n`);
        }
        if (c.includes("worktree list --porcelain")) {
          return Buffer.from(
            `worktree ${wtPath}\nHEAD abc\nbranch refs/heads/ai-shadow/stale-${oldTs}\n\n`,
          );
        }
        return Buffer.from("");
      });

      const r = pruneOrphanWorktrees({ ttlMs: 60 * 60 * 1000 }); // 1h
      expect(r.pruned).toBe(true);
      expect(r.reapedBranches).toBe(1);
      expect(r.reapedWorktrees).toBe(1);

      const allCmds = calls().join("\n");
      expect(allCmds).toContain(`git worktree remove --force ${wtPath}`);
      expect(allCmds).toContain(`git branch -D ai-shadow/stale-${oldTs}`);
      // Fresh branch must NOT be reaped.
      expect(allCmds).not.toContain(`git branch -D ai-shadow/fresh-${freshTs}`);
    });

    it("reaps branch even when no worktree is registered (orphan branch)", () => {
      const oldTs = Date.now() - 2 * 60 * 60 * 1000;
      vi.mocked(execSync).mockImplementation((cmd: unknown) => {
        const c = String(cmd);
        if (c.includes("for-each-ref")) return Buffer.from(`ai-shadow/lone-${oldTs}\n`);
        if (c.includes("worktree list --porcelain")) return Buffer.from("");
        return Buffer.from("");
      });
      const r = pruneOrphanWorktrees({ ttlMs: 60 * 60 * 1000 });
      expect(r.reapedBranches).toBe(1);
      expect(r.reapedWorktrees).toBe(0);
      expect(calls().join("\n")).toContain(`git branch -D ai-shadow/lone-${oldTs}`);
    });

    it("ignores branches with malformed timestamp suffix", () => {
      vi.mocked(execSync).mockImplementation((cmd: unknown) => {
        const c = String(cmd);
        if (c.includes("for-each-ref")) return Buffer.from("ai-shadow/no-ts\nai-shadow/abc-not-a-number\n");
        if (c.includes("worktree list --porcelain")) return Buffer.from("");
        return Buffer.from("");
      });
      const r = pruneOrphanWorktrees({ ttlMs: 0 });
      expect(r.reapedBranches).toBe(0);
    });

    it("tolerates per-branch reap failures and continues", () => {
      const oldTs = Date.now() - 2 * 60 * 60 * 1000;
      vi.mocked(execSync).mockImplementation((cmd: unknown) => {
        const c = String(cmd);
        if (c.includes("for-each-ref")) return Buffer.from(`ai-shadow/a-${oldTs}\nai-shadow/b-${oldTs}\n`);
        if (c.includes("worktree list --porcelain")) return Buffer.from("");
        if (c.includes(`branch -D ai-shadow/a-${oldTs}`)) throw new Error("locked");
        return Buffer.from("");
      });
      const r = pruneOrphanWorktrees({ ttlMs: 60 * 60 * 1000 });
      expect(r.pruned).toBe(true);
      expect(r.reapedBranches).toBe(1); // only b succeeded
    });
  });

  describe("isolation guarantee (the trampling fix)", () => {
    it("createShadowBranch never invokes git checkout — agent's shell branch is preserved", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      createShadowBranch("node_x");
      const allCommands = calls().join("\n");
      expect(allCommands).not.toMatch(/git checkout(?!.*HEAD$)/);
    });

    it("discardShadowBranch with full handle never invokes git checkout", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      discardShadowBranch({ branchName: "ai-shadow/x-1", worktreePath: "/tmp/wt" }, "main");
      const allCommands = calls().join("\n");
      // No checkout when the worktree path isolates us
      expect(allCommands).not.toMatch(/git checkout/);
    });
  });
});
