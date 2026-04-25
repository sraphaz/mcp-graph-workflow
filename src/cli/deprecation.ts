/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sprint 9 #9.5 — soft deprecation banner for the legacy v10 CLI surface.
 *
 * The user-facing CLI moved to `@mcp-graph-workflow/cli` (binaries `mg`
 * and `mcp-graph`) as of v10.2 / v11. The original `mcp-graph` binary
 * shipped from this package keeps working (no bin removal yet — see
 * blocked T1.0; ship it once the cli pkg is published) but starting at
 * the next minor a yellow banner nudges users toward the new install.
 *
 * Design constraints:
 *   - Banner goes to stderr, never stdout — stdout may be parsed by an
 *     MCP host as JSON-RPC frames.
 *   - Banner only fires on TTY stderr — agent hosts that pipe stderr
 *     for log capture get a clean, banner-free stream.
 *   - Function returns void; we never `process.exit(N)` from here. The
 *     legacy CLI continues to run normally after the banner; the
 *     deprecation is informational, not a block.
 */

const ANSI_YELLOW = "\x1b[33m";
const ANSI_RESET = "\x1b[0m";
const ANSI_BOLD = "\x1b[1m";

export interface DeprecationBannerOptions {
  /** New install command users should switch to. */
  readonly newCommand: string;
  /** Optional context line — typically the migration doc URL/path. */
  readonly migrationDoc?: string;
  /** Override TTY detection (used by tests). Defaults to `process.stderr.isTTY`. */
  readonly forceTTY?: boolean;
}

/**
 * Print a non-blocking deprecation banner to stderr. No-op when stderr
 * is not a TTY (agent hosts piping stderr) or when MCP_GRAPH_NO_BANNER=1.
 */
export function printDeprecationBanner(opts: DeprecationBannerOptions): void {
  if (process.env.MCP_GRAPH_NO_BANNER === "1") return;
  const isTTY = opts.forceTTY ?? Boolean(process.stderr.isTTY);
  if (!isTTY) return;
  const lines: string[] = [
    `${ANSI_YELLOW}${ANSI_BOLD}[mcp-graph] DEPRECATED${ANSI_RESET}`,
    `${ANSI_YELLOW}  This CLI entry is the legacy v10 surface.${ANSI_RESET}`,
    `${ANSI_YELLOW}  Switch to:${ANSI_RESET} ${ANSI_BOLD}${opts.newCommand}${ANSI_RESET}`,
  ];
  if (opts.migrationDoc) {
    lines.push(`${ANSI_YELLOW}  Migration:${ANSI_RESET} ${opts.migrationDoc}`);
  }
  lines.push(`${ANSI_YELLOW}  Silence with MCP_GRAPH_NO_BANNER=1${ANSI_RESET}`);
  process.stderr.write(`${lines.join("\n")}\n`);
}

/**
 * Format the banner as a string, no I/O. Tests assert on this directly
 * to avoid spying on process.stderr.write.
 */
export function formatDeprecationBanner(opts: DeprecationBannerOptions): string {
  const lines: string[] = [
    `${ANSI_YELLOW}${ANSI_BOLD}[mcp-graph] DEPRECATED${ANSI_RESET}`,
    `${ANSI_YELLOW}  This CLI entry is the legacy v10 surface.${ANSI_RESET}`,
    `${ANSI_YELLOW}  Switch to:${ANSI_RESET} ${ANSI_BOLD}${opts.newCommand}${ANSI_RESET}`,
  ];
  if (opts.migrationDoc) {
    lines.push(`${ANSI_YELLOW}  Migration:${ANSI_RESET} ${opts.migrationDoc}`);
  }
  lines.push(`${ANSI_YELLOW}  Silence with MCP_GRAPH_NO_BANNER=1${ANSI_RESET}`);
  return lines.join("\n");
}
