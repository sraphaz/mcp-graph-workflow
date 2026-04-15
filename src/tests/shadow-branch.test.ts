import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { createShadowBranch, mergeShadowBranch, discardShadowBranch, getShadowBranchName } from "../core/autonomy/shadow-branch.js";
import { execSync } from "node:child_process";

describe("shadow-branch", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  describe("getShadowBranchName", () => {
    it("should generate a branch name from node ID", () => {
      const name = getShadowBranchName("node_abc123");
      expect(name).toMatch(/^ai-shadow\/node_abc123-\d+$/);
    });
  });

  describe("createShadowBranch", () => {
    it("should create a new branch from current HEAD", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      const result = createShadowBranch("node_42");
      expect(result.branchName).toMatch(/^ai-shadow\/node_42-/);
      expect(result.created).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("git checkout -b ai-shadow/node_42-"),
        expect.any(Object),
      );
    });

    it("should return error info when git fails", () => {
      vi.mocked(execSync).mockImplementation(() => { throw new Error("fatal: branch already exists"); });
      const result = createShadowBranch("node_42");
      expect(result.created).toBe(false);
      expect(result.error).toContain("branch already exists");
    });
  });

  describe("mergeShadowBranch", () => {
    it("should ff-merge shadow branch into current and delete it", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      const result = mergeShadowBranch("ai-shadow/node_42-1713100000", "main");
      expect(result.merged).toBe(true);
      const calls = vi.mocked(execSync).mock.calls.map((c) => String(c[0]));
      expect(calls.some((c: string) => c.includes("git checkout main"))).toBe(true);
      expect(calls.some((c: string) => c.includes("git merge"))).toBe(true);
      expect(calls.some((c: string) => c.includes("git branch -D"))).toBe(true);
    });

    it("should return error when merge fails", () => {
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from(""))
        .mockImplementation(() => { throw new Error("merge conflict"); });
      const result = mergeShadowBranch("ai-shadow/node_42-123", "main");
      expect(result.merged).toBe(false);
      expect(result.error).toContain("merge conflict");
    });
  });

  describe("discardShadowBranch", () => {
    it("should switch to target branch and delete shadow", () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(""));
      const result = discardShadowBranch("ai-shadow/node_42-123", "main");
      expect(result.discarded).toBe(true);
      const calls = vi.mocked(execSync).mock.calls.map((c) => String(c[0]));
      expect(calls.some((c: string) => c.includes("git checkout main"))).toBe(true);
      expect(calls.some((c: string) => c.includes("git branch -D ai-shadow/node_42-123"))).toBe(true);
    });
  });
});
