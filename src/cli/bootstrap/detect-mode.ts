/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * CLI mode dispatcher — replaces the fragile heuristic at src/cli/index.ts:28
 * (`!process.stdin.isTTY && process.argv.length <= 2`) with explicit, testable
 * detection.
 *
 * Why the old heuristic broke:
 *   echo something | mcp-graph status   →   stdin is non-TTY + argv length 3
 *   But the user clearly wants the `status` subcommand, not stdio MCP server.
 *   The old code routed it to MCP. New code routes by explicit signals.
 *
 * Detection priority (first match wins):
 *
 *   1. mcp-stdio   ←  --stdio flag, `mcp` subcommand, or MCP_GRAPH_STDIO=1 env
 *   2. non-interactive  ←  any subcommand present (with or without TTY)
 *                            OR --json/--quiet flag present
 *   3. wizard  ←  `init` subcommand AND TTY stdin (interactive setup)
 *                  (matched before non-interactive for `init` specifically)
 *   4. interactive  ←  no subcommand AND TTY stdin (default → opens REPL)
 *   5. non-interactive (fallback)  ←  no subcommand AND no TTY (e.g. piped --help)
 */

export type CliMode = "mcp-stdio" | "non-interactive" | "interactive" | "wizard";

export interface DetectModeInput {
  /** Full process.argv minus node binary path. e.g. ["mcp-graph", "status", "--json"]. */
  argv: readonly string[];
  /** Read-only snapshot of relevant env vars. */
  env: Record<string, string | undefined>;
  /** Whether process.stdin is a terminal. */
  isStdinTTY: boolean;
  /** Whether process.stdout is a terminal. */
  isStdoutTTY: boolean;
}

export interface DetectModeResult {
  mode: CliMode;
  /** Short human reason — useful for logs and tests. */
  reason: string;
}

/** Subcommand list that the new CLI ships. Anything outside this is treated as plain args. */
const KNOWN_SUBCOMMANDS = new Set([
  "serve",
  "import",
  "status",
  "stats", // legacy alias for status (will warn on deprecation)
  "reindex",
  "index", // legacy alias for reindex
  "init",
  "doctor",
  "update",
  "hello",
  "mcp",
  "skills",
  "dev",
]);

/** Flags that force a specific mode regardless of other signals. */
const STDIO_FLAGS = new Set(["--stdio", "--mcp"]);
const JSON_FLAGS = new Set(["--json", "--quiet", "-q"]);

/** Strip the leading two argv slots when present (node binary + script path). */
function normalizeArgv(argv: readonly string[]): string[] {
  // argv[0] is node, argv[1] is script. We only care about argv[2..].
  // Callers can pass full process.argv or just the user args — we sniff which:
  // if argv[0] looks like a node interpreter path, treat as full process.argv.
  const first = argv[0];
  if (first && (first.endsWith("node") || first.endsWith("node.exe") || first === "node")) {
    return [...argv.slice(2)];
  }
  return [...argv];
}

function findSubcommand(args: string[]): string | null {
  for (const arg of args) {
    if (arg.startsWith("-")) continue; // skip flags
    if (KNOWN_SUBCOMMANDS.has(arg)) return arg;
    // First non-flag token is the would-be subcommand even if unknown — let the
    // CLI parser surface "unknown command" downstream.
    return arg;
  }
  return null;
}

function hasAnyFlag(args: string[], flags: Set<string>): boolean {
  return args.some((arg) => flags.has(arg));
}

/**
 * Pure mode detection. Total over inputs — never throws, always returns a mode + reason.
 *
 * The order of checks below mirrors the priority documented at the top of the file.
 * Each branch must produce a `reason` short enough to fit a single log line so
 * `mcp-graph` boot can emit it at debug level.
 */
export function detectMode(input: DetectModeInput): DetectModeResult {
  const args = normalizeArgv(input.argv);

  // 1. Explicit stdio signals
  if (hasAnyFlag(args, STDIO_FLAGS)) {
    return { mode: "mcp-stdio", reason: "explicit --stdio/--mcp flag" };
  }
  if (input.env.MCP_GRAPH_STDIO === "1" || input.env.MCP_GRAPH_STDIO === "true") {
    return { mode: "mcp-stdio", reason: "MCP_GRAPH_STDIO env set" };
  }

  const subcommand = findSubcommand(args);

  if (subcommand === "mcp") {
    return { mode: "mcp-stdio", reason: "subcommand 'mcp'" };
  }

  // 3. Wizard for `init` in interactive terminal (matched before generic non-interactive
  //    so that piped `init --yes-all` correctly stays non-interactive).
  if (subcommand === "init" && input.isStdinTTY && !hasAnyFlag(args, new Set(["--yes-all", "--no-copilot"]))) {
    return { mode: "wizard", reason: "init subcommand in TTY without --yes-all" };
  }

  // 2. Any other subcommand → non-interactive (with or without TTY)
  if (subcommand !== null) {
    return { mode: "non-interactive", reason: `subcommand '${subcommand}'` };
  }

  // No subcommand. Force non-interactive if --json was passed.
  if (hasAnyFlag(args, JSON_FLAGS)) {
    return { mode: "non-interactive", reason: "--json/--quiet flag, no subcommand" };
  }

  // 4. Interactive REPL when running in a real terminal with no subcommand.
  if (input.isStdinTTY && input.isStdoutTTY) {
    return { mode: "interactive", reason: "TTY stdin+stdout, no subcommand" };
  }

  // 5. Fallback: no TTY, no subcommand.
  //    Old heuristic routed this to MCP stdio. We now require explicit --stdio
  //    to avoid pipe accidents like `echo x | mcp-graph` opening a JSON-RPC server.
  //    Most commonly this case is `mcp-graph </dev/null` from a non-interactive
  //    shell, which should print help and exit (handled by non-interactive mode).
  return {
    mode: "non-interactive",
    reason: "no subcommand, no TTY (use --stdio to start MCP server)",
  };
}
