import { describe, it, expect } from "vitest";
import { executeBuild } from "../../core/sandbox/builder-executor.js";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

describe("executeBuild — Wave-12 Builder (Process Isolation)", () => {
  describe("success path", () => {
    it("runs a trivial command and reports success", async () => {
      const result = await executeBuild({
        command: "echo",
        args: ["hello-sandbox"],
        isolation: "process",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("success");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("hello-sandbox");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.isolation).toBe("process");
    });

    it("captures stdout and stderr separately", async () => {
      const result = await executeBuild({
        command: "sh",
        args: ["-c", "echo OUT; echo ERR >&2"],
        isolation: "process",
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain("OUT");
      expect(result.stderr).toContain("ERR");
    });
  });

  describe("failure path", () => {
    it("reports failure when the command exits non-zero", async () => {
      const result = await executeBuild({
        command: "sh",
        args: ["-c", "exit 7"],
        isolation: "process",
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("failure");
      expect(result.exitCode).toBe(7);
    });
  });

  describe("timeout", () => {
    it("hard-kills a long-running command and reports timeout", async () => {
      const result = await executeBuild({
        command: "sh",
        args: ["-c", "sleep 10"],
        isolation: "process",
        timeoutMs: 120,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("timeout");
      expect(result.durationMs).toBeLessThan(2000); // killed fast, not waited 10s
    });
  });

  describe("isolation — workDir", () => {
    it("runs with an explicit working directory", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "builder-wd-"));
      try {
        const result = await executeBuild({
          command: "pwd",
          args: [],
          isolation: "process",
          workDir: tmp,
        });

        expect(result.success).toBe(true);
        // pwd can return a canonicalized path (/private/tmp on macOS); assert via realpath
        const realTmp = fs.realpathSync(tmp);
        expect(result.stdout.trim()).toBe(realTmp);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe("profile routing", () => {
    it("defaults to ci-mirror profile when omitted", async () => {
      const result = await executeBuild({
        command: "echo",
        args: ["x"],
        isolation: "process",
      });

      expect(result.profile).toBe("ci-mirror");
    });

    it("honors fast / full profile when provided", async () => {
      const fast = await executeBuild({
        command: "echo",
        args: ["x"],
        isolation: "process",
        profile: "fast",
      });
      const full = await executeBuild({
        command: "echo",
        args: ["x"],
        isolation: "process",
        profile: "full",
      });

      expect(fast.profile).toBe("fast");
      expect(full.profile).toBe("full");
    });
  });

  describe("unsupported isolation modes", () => {
    it("throws a clear error when docker/podman is requested (not yet implemented)", async () => {
      await expect(
        executeBuild({
          command: "echo",
          args: ["x"],
          isolation: "docker" as const,
        }),
      ).rejects.toThrow(/not yet implemented|unsupported/i);
    });
  });
});
