/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { runShellHandler } from "../core/hooks/shell-handler.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

const event: HookEvent = {
  channel: "tool:pre-call",
  timestamp: "2026-04-28T20:00:00.000Z",
  payload: { toolName: "test", args: { foo: "bar" } },
};

describe("Shell handler runner — runShellHandler", () => {
  it("returns decision='pass' when handler exits 0", async () => {
    const result = await runShellHandler(
      { id: "ok", command: "node", args: ["-e", "process.exit(0)"] },
      event,
    );
    expect(result.decision).toBe("pass");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("returns decision='block' with stderr when handler exits 2", async () => {
    const result = await runShellHandler(
      {
        id: "block",
        command: "node",
        args: ["-e", "process.stderr.write('blocked: rm -rf detected\\n'); process.exit(2)"],
      },
      event,
    );
    expect(result.decision).toBe("block");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("blocked: rm -rf detected");
  });

  it("returns decision='warn' for non-0/2 exit codes", async () => {
    const result = await runShellHandler(
      { id: "warn-1", command: "node", args: ["-e", "process.exit(1)"] },
      event,
    );
    expect(result.decision).toBe("warn");
    expect(result.exitCode).toBe(1);
  });

  it("kills the subprocess on timeout and returns timedOut=true with decision='warn'", async () => {
    const result = await runShellHandler(
      { id: "slow", command: "node", args: ["-e", "setTimeout(() => process.exit(0), 5000)"], timeoutMs: 200 },
      event,
    );
    expect(result.timedOut).toBe(true);
    expect(result.decision).toBe("warn");
  });

  it("delivers the HookEvent as stdin JSON (one line)", async () => {
    const result = await runShellHandler(
      {
        id: "echo-stdin",
        command: "node",
        args: [
          "-e",
          "let s=''; process.stdin.on('data',c=>s+=c); process.stdin.on('end',()=>{const ev=JSON.parse(s); if(ev.channel==='tool:pre-call') process.exit(0); process.stderr.write('bad: '+s); process.exit(2);})",
        ],
      },
      event,
    );
    expect(result.decision).toBe("pass");
  });

  it("scrubs the host environment except PATH/HOME and MCP_GRAPH_* keys", async () => {
    process.env.MCP_GRAPH_TEST_FLAG = "yes";
    process.env.SECRET_API_KEY = "leaked-if-passed-through";
    try {
      const result = await runShellHandler(
        {
          id: "env-check",
          command: "node",
          args: [
            "-e",
            "if(process.env.MCP_GRAPH_TEST_FLAG!=='yes'){process.stderr.write('MCP_GRAPH_TEST_FLAG missing'); process.exit(2)} if(process.env.SECRET_API_KEY){process.stderr.write('SECRET_API_KEY leaked'); process.exit(2)} process.exit(0)",
          ],
        },
        event,
      );
      expect(result.decision).toBe("pass");
      expect(result.stderr).toBe("");
    } finally {
      delete process.env.MCP_GRAPH_TEST_FLAG;
      delete process.env.SECRET_API_KEY;
    }
  });

  it("returns decision='warn' when the command is not found", async () => {
    const result = await runShellHandler(
      { id: "missing", command: "/nonexistent/binary/that/does/not/exist" },
      event,
    );
    expect(result.decision).toBe("warn");
    expect(result.exitCode).toBeNull();
  });
});
