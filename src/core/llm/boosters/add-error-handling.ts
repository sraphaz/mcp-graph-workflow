/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05c — Booster transform: add-error-handling.
 *
 * Pure: detects raw `throw new Error(...)` and rewrites to
 * `throw new McpGraphError(...)` (project's typed error class). When at
 * least one rewrite happens and the import is missing, auto-imports
 * McpGraphError. Skips lines already inside try/catch blocks (best-effort
 * brace counting) — caller's responsibility for paths.
 *
 * Conservative: doesn't add try/catch wrappers around bare async fns
 * (would need full AST), focuses on the common throw-replacement target.
 */

const RAW_THROW_RE =
  /^(?<indent>[ \t]*)throw\s+new\s+Error\((?<args>[\s\S]*?)\);?\s*$/gm;

const IMPORT_PREFIX = `import { McpGraphError } from `;
const DEFAULT_IMPORT_PATH = '"../utils/errors.js"';

export interface AddErrorHandlingOptions {
  errorImportPath?: string;
}

export interface AddErrorHandlingResult {
  output: string;
  rewritten: number;
  importAdded: boolean;
}

function hasMcpGraphErrorImport(source: string): boolean {
  return source.includes(IMPORT_PREFIX);
}

function isInsideTryBlock(source: string, idx: number): boolean {
  // Walk back tracking braces; if a `try {` opens before any matching `}`,
  // we're inside a try-block. Best-effort, ignores strings/comments.
  let depth = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const c = source[i];
    if (c === "}") depth++;
    else if (c === "{") {
      if (depth > 0) {
        depth--;
        continue;
      }
      // Look back for `try` token immediately before this `{`.
      const prefix = source.slice(Math.max(0, i - 8), i).trim();
      if (/\btry$/.test(prefix)) return true;
      return false;
    }
  }
  return false;
}

export function addErrorHandling(
  source: string,
  opts: AddErrorHandlingOptions = {},
): AddErrorHandlingResult {
  let rewritten = 0;
  RAW_THROW_RE.lastIndex = 0;
  const matches = [...source.matchAll(RAW_THROW_RE)];
  let out = source;
  let offset = 0;
  for (const m of matches) {
    if (m.index === undefined) continue;
    const start = m.index + offset;
    if (isInsideTryBlock(out, start)) continue;
    const groups = m.groups as { indent: string; args: string };
    const replacement = `${groups.indent}throw new McpGraphError(${groups.args.trim()});`;
    out = out.slice(0, start) + replacement + out.slice(start + m[0].length);
    offset += replacement.length - m[0].length;
    rewritten++;
  }

  let importAdded = false;
  if (rewritten > 0 && !hasMcpGraphErrorImport(out)) {
    const importPath = opts.errorImportPath ?? DEFAULT_IMPORT_PATH;
    out = `${IMPORT_PREFIX}${importPath};\n${out}`;
    importAdded = true;
  }

  return { output: out, rewritten, importAdded };
}
