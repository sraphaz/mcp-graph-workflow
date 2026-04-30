/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Security suite for the shell-handler runner. Verifies the contract that
 * separates the mcp-graph host from user-supplied subprocess code:
 * - args are passed as an argv array (no shell interpretation)
 * - oversize stderr is truncated, not buffered unbounded
 * - hung processes are SIGKILLed within timeout + small grace
 * - env scrubbing is enforced (already covered in shell-handler.test.ts; we
 *   re-assert the most dangerous case here as a regression backstop).
 */

import { describe, it, expect } from "vitest";
import { runShellHandler } from "../core/hooks/shell-handler.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

const event: HookEvent = {
  channel: "tool:pre-call",
  timestamp: "2026-04-28T20:00:00.000Z",
  payload: { toolName: "test", args: {} },
};

describe("Shell handler — security contract", () => {
  it("does NOT shell-interpret args (metachar args reach argv verbatim)", async () => {
    // If args were shell-interpreted, `; echo PWNED` would fork another
    // process. With argv pass-through, it's just a literal arg printed back.
    const result = await runShellHandler(
      {
        id: "metachar",
        command: "node",
        args: [
          "-e",
          "if(process.argv[1]==='; echo PWNED'){process.exit(0)}else{process.stderr.write('arg='+process.argv[1]); process.exit(2)}",
          "; echo PWNED",
        ],
      },
      event,
    );
    expect(result.decision).toBe("pass");
    expect(result.stderr).toBe("");
  });

  it("truncates stderr at 64KiB and adds explicit marker", async () => {
    // §post-13.2.0 — Spew ~200KB to stderr with backpressure-aware writes.
    // The previous implementation (sync `for` loop writing 80KB) was unreliable
    // on Linux runners: the child sometimes exited before enough data drained
    // through the pipe to trip the MAX_STDERR_BYTES (64KB) cap in the parent.
    // 200KB of data + drain handling guarantees the parent observes ≥64KB
    // regardless of pipe-buffer timing on macOS or Linux.
    const result = await runShellHandler(
      {
        id: "stderr-flood",
        command: "node",
        args: [
          "-e",
          "const block='X'.repeat(1024);let written=0;function w(){if(written>=200){process.exit(2);return}written++;if(process.stderr.write(block))setImmediate(w);else process.stderr.once('drain',w)}w();",
        ],
      },
      event,
    );
    expect(result.decision).toBe("block");
    expect(result.stderr.length).toBeLessThan(70 * 1024);
    expect(result.stderr).toMatch(/stderr truncated at \d+ bytes/);
  });

  it("kills a hung process and returns within ~timeout + small grace", async () => {
    const t0 = Date.now();
    const result = await runShellHandler(
      {
        id: "hang",
        command: "node",
        args: ["-e", "setInterval(() => {}, 1000)"], // never exits naturally
        timeoutMs: 250,
      },
      event,
    );
    const elapsed = Date.now() - t0;
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(2000); // generous CI buffer
  });

  it("regression: SECRET_API_KEY never leaks into the subprocess env", async () => {
    process.env.SECRET_API_KEY = "leaked-if-passed-through";
    try {
      const result = await runShellHandler(
        {
          id: "env-leak",
          command: "node",
          args: [
            "-e",
            "if(process.env.SECRET_API_KEY){process.stderr.write('LEAK'); process.exit(2)} process.exit(0)",
          ],
        },
        event,
      );
      expect(result.decision).toBe("pass");
      expect(result.stderr).toBe("");
    } finally {
      delete process.env.SECRET_API_KEY;
    }
  });
});
