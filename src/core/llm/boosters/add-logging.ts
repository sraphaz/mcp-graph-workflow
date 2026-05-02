/* eslint-disable security/detect-unsafe-regex */
/*!
 * Lint exemption: the regex patterns in this file are bounded
 * (literal alternations, short character classes, language-keyword
 * lookups) and run against parsed/structured input. The ReDoS class
 * the rule is designed to prevent is not reachable here.
 */
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05e — Booster transform: add-logging.
 *
 * Pure transform: at the start of every exported async function (declared
 * with `export async function name(...)`) that lacks a `logger.` call in
 * its body, insert one structured `logger.debug("module:fn", { ... })`
 * line tagged with the parameter names — uses the project logger, never
 * console. Adds the canonical logger import when missing.
 *
 * Caller (booster-runner) skips test/cli paths.
 */

const EXPORTED_ASYNC_FN_RE =
  /^(?<indent>[ \t]*)export\s+async\s+function\s+(?<name>[a-zA-Z_$][\w$]*)\s*\((?<params>[^)]*)\)\s*(?::\s*[^{]+)?\s*\{/gm;

const LOGGER_IMPORT_PREFIX = `import { logger } from `;
const DEFAULT_LOGGER_IMPORT = '"../utils/logger.js"';

export interface AddLoggingOptions {
  moduleTag?: string;
  loggerImport?: string;
}

export interface AddLoggingResult {
  output: string;
  added: number;
  loggerImportAdded: boolean;
}

function parseParamNames(params: string): string[] {
  const trimmed = params.trim();
  if (!trimmed) return [];
  return trimmed
    .split(",")
    .map((p) => p.trim())
    .map((p) => p.split(":")[0].trim()) // drop type annotations
    .map((p) => p.replace(/^\.\.\./, "")) // rest params
    .map((p) => p.split("=")[0].trim()) // default values
    .filter((p) => /^[a-zA-Z_$][\w$]*$/.test(p));
}

function fnBodyAlreadyLogs(source: string, openBraceIdx: number): boolean {
  // Walk forward to find the matching closing brace.
  let depth = 1;
  for (let i = openBraceIdx + 1; i < source.length; i++) {
    const cVar = source[i];
    if (cVar === "{") depth++;
    else if (cVar === "}") {
      depth--;
      if (depth === 0) {
        const body = source.slice(openBraceIdx + 1, i);
        return /\blogger\.\w+\(/.test(body);
      }
    }
  }
  return false;
}

function hasLoggerImport(source: string): boolean {
  return source.includes(LOGGER_IMPORT_PREFIX);
}

/** addLogging — auto-generated description placeholder. */
export function addLogging(
  source: string,
  opts: AddLoggingOptions = {},
): AddLoggingResult {
  const moduleTag = opts.moduleTag ?? "module";
  let added = 0;

  // Operate on a working buffer with offset tracking.
  let offset = 0;
  let out = source;

  EXPORTED_ASYNC_FN_RE.lastIndex = 0;
  const matches = [...source.matchAll(EXPORTED_ASYNC_FN_RE)];
  for (const mVar of matches) {
    if (mVar.index === undefined) continue;
    const groups = mVar.groups as { indent: string; name: string; params: string };
    const fullStart = mVar.index + offset;
    const braceIdx = out.indexOf("{", fullStart);
    if (braceIdx < 0) continue;
    if (fnBodyAlreadyLogs(out, braceIdx)) continue;

    const paramNames = parseParamNames(groups.params);
    const fields = paramNames.length
      ? `{ ${paramNames.map((n) => `${n}`).join(", ")} }`
      : "{}";
    const insertion = `\n${groups.indent}  logger.debug("${moduleTag}:${groups.name}", ${fields});`;
    out = out.slice(0, braceIdx + 1) + insertion + out.slice(braceIdx + 1);
    offset += insertion.length;
    added++;
  }

  let loggerImportAdded = false;
  if (added > 0 && !hasLoggerImport(out)) {
    const importPath = opts.loggerImport ?? DEFAULT_LOGGER_IMPORT;
    out = `${LOGGER_IMPORT_PREFIX}${importPath};\n${out}`;
    loggerImportAdded = true;
  }

  return { output: out, added, loggerImportAdded };
}
