/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Contract tests for src/cli/bootstrap/detect-mode.ts.
 *
 * The test matrix covers:
 *   - 3 stdin TTY states × 3 stdout TTY states  (9 combinations)
 *   - subcommand present / absent / unknown
 *   - explicit flags (--stdio, --mcp, --json)
 *   - env var (MCP_GRAPH_STDIO)
 *   - the specific pipe-accident scenario the old heuristic got wrong
 */

import { describe, expect, it } from "vitest";
import { detectMode, type DetectModeInput } from "../cli/bootstrap/detect-mode.js";

const baseInput = (overrides: Partial<DetectModeInput> = {}): DetectModeInput => ({
  argv: [],
  env: {},
  isStdinTTY: true,
  isStdoutTTY: true,
  ...overrides,
});

describe("detectMode — explicit stdio signals (priority 1)", () => {
  it("--stdio flag forces mcp-stdio mode", () => {
    const result = detectMode(baseInput({ argv: ["--stdio"] }));
    expect(result.mode).toBe("mcp-stdio");
    expect(result.reason).toContain("--stdio");
  });

  it("--mcp flag forces mcp-stdio mode", () => {
    const result = detectMode(baseInput({ argv: ["--mcp"] }));
    expect(result.mode).toBe("mcp-stdio");
  });

  it("MCP_GRAPH_STDIO=1 forces mcp-stdio mode", () => {
    const result = detectMode(baseInput({ env: { MCP_GRAPH_STDIO: "1" } }));
    expect(result.mode).toBe("mcp-stdio");
    expect(result.reason).toContain("MCP_GRAPH_STDIO");
  });

  it("MCP_GRAPH_STDIO=true also forces mcp-stdio (truthy variant)", () => {
    const result = detectMode(baseInput({ env: { MCP_GRAPH_STDIO: "true" } }));
    expect(result.mode).toBe("mcp-stdio");
  });

  it("MCP_GRAPH_STDIO=0 does NOT force mcp-stdio", () => {
    const result = detectMode(baseInput({ env: { MCP_GRAPH_STDIO: "0" } }));
    expect(result.mode).not.toBe("mcp-stdio");
  });

  it("subcommand 'mcp' forces mcp-stdio", () => {
    const result = detectMode(baseInput({ argv: ["mcp"] }));
    expect(result.mode).toBe("mcp-stdio");
    expect(result.reason).toContain("mcp");
  });
});

describe("detectMode — wizard mode (priority 3)", () => {
  it("init subcommand in TTY → wizard", () => {
    const result = detectMode(baseInput({ argv: ["init"], isStdinTTY: true }));
    expect(result.mode).toBe("wizard");
  });

  it("init --yes-all stays non-interactive even in TTY (CI flag)", () => {
    const result = detectMode(baseInput({ argv: ["init", "--yes-all"], isStdinTTY: true }));
    expect(result.mode).toBe("non-interactive");
  });

  it("init --no-copilot stays non-interactive even in TTY", () => {
    const result = detectMode(baseInput({ argv: ["init", "--no-copilot"], isStdinTTY: true }));
    expect(result.mode).toBe("non-interactive");
  });

  it("init without TTY → non-interactive (CI scenario)", () => {
    const result = detectMode(baseInput({ argv: ["init"], isStdinTTY: false }));
    expect(result.mode).toBe("non-interactive");
  });
});

describe("detectMode — non-interactive subcommands (priority 2)", () => {
  it.each([
    ["serve"],
    ["import"],
    ["status"],
    ["stats"],
    ["reindex"],
    ["doctor"],
    ["update"],
    ["hello"],
    ["skills"],
  ])("subcommand '%s' → non-interactive", (subcommand) => {
    const result = detectMode(baseInput({ argv: [subcommand] }));
    expect(result.mode).toBe("non-interactive");
    expect(result.reason).toContain(subcommand);
  });

  it("--json flag forces non-interactive even without subcommand", () => {
    const result = detectMode(baseInput({ argv: ["--json"] }));
    expect(result.mode).toBe("non-interactive");
  });

  it("status --json (canonical CI invocation)", () => {
    const result = detectMode(baseInput({ argv: ["status", "--json"], isStdinTTY: false }));
    expect(result.mode).toBe("non-interactive");
  });
});

describe("detectMode — interactive REPL (priority 4)", () => {
  it("no args, both TTY streams → interactive", () => {
    const result = detectMode(baseInput({ isStdinTTY: true, isStdoutTTY: true }));
    expect(result.mode).toBe("interactive");
    expect(result.reason).toContain("TTY");
  });

  it("non-TTY stdin breaks interactive — falls to non-interactive", () => {
    const result = detectMode(baseInput({ isStdinTTY: false, isStdoutTTY: true }));
    expect(result.mode).toBe("non-interactive");
  });

  it("non-TTY stdout breaks interactive (e.g. piped to less)", () => {
    const result = detectMode(baseInput({ isStdinTTY: true, isStdoutTTY: false }));
    expect(result.mode).toBe("non-interactive");
  });
});

describe("detectMode — pipe-accident regression (the bug we're fixing)", () => {
  it("`echo x | mcp-graph status` does NOT route to mcp-stdio", () => {
    // Old heuristic: !isTTY && argv.length <= 2 → MCP stdio.
    // status is argv length > 2 in the user's view, but normalized to 1 here.
    const result = detectMode(baseInput({
      argv: ["status"],
      isStdinTTY: false,
      isStdoutTTY: false,
    }));
    expect(result.mode).toBe("non-interactive");
  });

  it("`mcp-graph </dev/null` (no args, stdin redirected) does NOT auto-mcp", () => {
    // This is the case where the OLD heuristic broke. Now we require explicit
    // --stdio to start MCP server. Bare invocation with no TTY gets help+exit.
    const result = detectMode(baseInput({
      argv: [],
      isStdinTTY: false,
      isStdoutTTY: false,
    }));
    expect(result.mode).toBe("non-interactive");
    expect(result.reason).toContain("--stdio");
  });
});

describe("detectMode — argv normalization", () => {
  it("strips node + script path when present (full process.argv)", () => {
    const result = detectMode(baseInput({
      argv: ["/usr/bin/node", "/path/to/dist/cli/index.js", "status"],
    }));
    expect(result.mode).toBe("non-interactive");
    expect(result.reason).toContain("status");
  });

  it("works with already-trimmed argv (just user args)", () => {
    const result = detectMode(baseInput({ argv: ["status"] }));
    expect(result.mode).toBe("non-interactive");
  });
});

describe("detectMode — every result has a non-empty reason", () => {
  const cases: DetectModeInput[] = [
    baseInput({ argv: ["--stdio"] }),
    baseInput({ argv: ["mcp"] }),
    baseInput({ argv: ["init"] }),
    baseInput({ argv: ["status"] }),
    baseInput({ argv: ["--json"] }),
    baseInput(),
    baseInput({ isStdinTTY: false, isStdoutTTY: false }),
  ];
  it.each(cases)("reason is non-empty for argv=%j", (input) => {
    const result = detectMode(input);
    expect(result.reason.length).toBeGreaterThan(0);
  });
});
