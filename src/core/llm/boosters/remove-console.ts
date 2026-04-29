/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05f — Booster transform: remove-console.
 *
 * Pure transform. Removes `console.<method>(...)` statements from src/
 * files (test files are skipped — caller decides via filePath). When at
 * least one console call is replaced with a logger call, ensures the
 * canonical logger import is present.
 *
 * Strategy:
 *   - console.log/info/debug → DROP (silent)
 *   - console.warn/error    → REPLACE with logger.warn/error
 *   - console.* on test/CLI paths → leave alone (caller's responsibility)
 */

const CONSOLE_CALL_RE =
  /^(?<indent>\s*)console\.(?<method>log|debug|info|warn|error|trace)\((?<args>[^;]*)\);?\s*$/gm;

const LOGGER_IMPORT_PREFIX = `import { logger } from `;

export interface RemoveConsoleResult {
  output: string;
  removed: number;
  upgraded: number;
  loggerImportAdded: boolean;
}

function hasLoggerImport(source: string): boolean {
  return source.includes(LOGGER_IMPORT_PREFIX);
}

export interface RemoveConsoleOptions {
  /** Path to logger module relative to the file. Default: "../utils/logger.js" */
  loggerImport?: string;
}

const DEFAULT_LOGGER_IMPORT = '"../utils/logger.js"';

export function removeConsole(
  source: string,
  opts: RemoveConsoleOptions = {},
): RemoveConsoleResult {
  let removed = 0;
  let upgraded = 0;

  const out = source.replace(CONSOLE_CALL_RE, (...args) => {
    const groups = args[args.length - 1] as { indent: string; method: string; args: string };
    const { indent, method, args: argList } = groups;
    if (method === "warn" || method === "error") {
      upgraded++;
      return `${indent}logger.${method}(${argList});`;
    }
    removed++;
    return ""; // drop the line entirely
  });

  // Collapse blank lines from drops to keep diff small.
  const compact = out.replace(/\n{3,}/g, "\n\n");

  let final = compact;
  let loggerImportAdded = false;
  if (upgraded > 0 && !hasLoggerImport(final)) {
    const importPath = opts.loggerImport ?? DEFAULT_LOGGER_IMPORT;
    final = `${LOGGER_IMPORT_PREFIX}${importPath};\n${final}`;
    loggerImportAdded = true;
  }

  return { output: final, removed, upgraded, loggerImportAdded };
}
