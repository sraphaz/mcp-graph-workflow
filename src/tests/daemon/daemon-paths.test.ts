import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveDaemonPaths } from "../../core/daemon/daemon-paths.js";

const FAKE_HOME = "/fake/home";

describe("resolveDaemonPaths", () => {
  it("derives deterministic paths from the workspace path", () => {
    const a = resolveDaemonPaths("/Users/x/proj", FAKE_HOME);
    const b = resolveDaemonPaths("/Users/x/proj", FAKE_HOME);
    expect(a).toEqual(b);
  });

  it("produces different state dirs for different workspaces", () => {
    const a = resolveDaemonPaths("/Users/x/alpha", FAKE_HOME);
    const b = resolveDaemonPaths("/Users/x/beta", FAKE_HOME);
    expect(a.stateDir).not.toBe(b.stateDir);
    expect(a.socketPath).not.toBe(b.socketPath);
  });

  it("normalizes relative workspace paths before hashing", () => {
    const abs = resolveDaemonPaths(path.resolve("./sub"), FAKE_HOME);
    const rel = resolveDaemonPaths("./sub", FAKE_HOME);
    expect(abs).toEqual(rel);
  });

  it("places state dir under the given home", () => {
    const p = resolveDaemonPaths("/anything", FAKE_HOME);
    expect(p.stateDir.startsWith(path.join(FAKE_HOME, ".mcp-graph"))).toBe(true);
  });

  it("emits pidFile and logFile inside the state dir", () => {
    const p = resolveDaemonPaths("/anything", FAKE_HOME);
    expect(path.dirname(p.pidFile)).toBe(p.stateDir);
    expect(path.dirname(p.logFile)).toBe(p.stateDir);
  });

  it("socket path matches the current platform convention", () => {
    const p = resolveDaemonPaths("/anything", FAKE_HOME);
    if (process.platform === "win32") {
      expect(p.socketPath.startsWith("\\\\.\\pipe\\mcp-graph-")).toBe(true);
    } else {
      expect(p.socketPath).toBe(path.join(p.stateDir, "daemon.sock"));
    }
  });
});
