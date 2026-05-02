/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * DaVinci JS → Java method body translator (MVP).
 *
 * Closes the TODO stub at plugin-generator.ts:164. Conservative, rule-based
 * translation:
 *
 *   1. extractFunctionBody  — strips the `module.exports = ...` wrapper so we
 *      operate on the bare JS body. Three input shapes recognized: arrow
 *      (`async ({params}) => {...}`), function expression, and raw (no
 *      wrapper).
 *   2. substituteTemplateVariables — replaces `{{global.variables.X}}` with
 *      `configuration.getFieldValue("X")`. Local/flow vars become a `TODO`
 *      Java comment because they require runtime context the plugin doesn't
 *      have at translation time.
 *   3. translateDaVinciToJavaBody — composes both, emits the original JS
 *      as a Java block-comment audit trail, and adds a logger entry so the
 *      generated plugin is observable at runtime.
 *
 * NOT IN SCOPE (emits `// PARTIAL TRANSLATION — manual review` instead):
 *   - `await` / Promises / async control flow
 *   - `fetch` / `XMLHttpRequest` / network calls
 *   - JSON parse/stringify
 *   - Complex object/array destructuring
 *
 * Anything outside the supported set keeps the original JS as a comment
 * so the operator can finish the translation by hand. `partial=true`
 * surfaces the partial-translation status to the caller.
 */

// `[\s\S]*` is anchored by `\}\s*;?\s*$` so backtracking is bounded —
// no catastrophic blowup. Eslint's heuristic flags greedy `.*`-style; we
// suppress because the body is the entire DaVinci function and we need
// to capture nested braces.
// eslint-disable-next-line security/detect-unsafe-regex
const ARROW_WRAPPER_REGEX = /module\.exports\s*=(?:\s*\w+\s*=)?\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{([\s\S]*)\}\s*;?\s*$/;
// eslint-disable-next-line security/detect-unsafe-regex
const FUNCTION_WRAPPER_REGEX = /module\.exports\s*=(?:\s*\w+\s*=)?\s*(?:async\s+)?function\s*\([^)]*\)\s*\{([\s\S]*)\}\s*;?\s*$/;

const TEMPLATE_VAR_REGEX = /\{\{([^}]+)\}\}/g;

const UNSUPPORTED_PATTERNS: ReadonlyArray<{ regex: RegExp; reason: string }> = [
  { regex: /\bawait\b/, reason: "async/await is not supported in PingAccess plugins" },
  { regex: /\bfetch\s*\(/, reason: "fetch() — translate to Apache HttpClient or PingAccess HTTP API" },
  { regex: /\bXMLHttpRequest\b/, reason: "XMLHttpRequest — translate to server-side HTTP API" },
  { regex: /\bJSON\.parse\s*\(/, reason: "JSON.parse — translate to Jackson ObjectMapper or org.json" },
  { regex: /\bJSON\.stringify\s*\(/, reason: "JSON.stringify — translate to Jackson ObjectMapper" },
  { regex: /\bnew\s+Promise\b/, reason: "Promise — PingAccess runtime is synchronous" },
  { regex: /\b\.then\s*\(/, reason: ".then() chain — PingAccess runtime is synchronous" },
];

// ──────────────────────────────────────────────────────────────────────────────

export type ExtractedBodyKind = "arrow" | "function" | "raw";

export interface ExtractedBody {
  kind: ExtractedBodyKind;
  body: string;
}

/**
 * Strip the `module.exports = ...` wrapper if present and return the inner
 * function body as plain text. If no wrapper is found, the input is treated
 * as already unwrapped (`kind: "raw"`).
 */
export function extractFunctionBody(code: string): ExtractedBody {
  const m1 = code.match(ARROW_WRAPPER_REGEX);
  if (m1) return { kind: "arrow", body: m1[1] };
  const m2 = code.match(FUNCTION_WRAPPER_REGEX);
  if (m2) return { kind: "function", body: m2[1] };
  return { kind: "raw", body: code };
}

// ──────────────────────────────────────────────────────────────────────────────

export interface SubstituteResult {
  code: string;
  substitutions: number;
  unresolved: string[];
}

/**
 * Replace `{{global.variables.X}}` with `configuration.getFieldValue("X")`.
 * For `{{local.*}}` and `{{flow.*}}`, emit a `TODO` Java comment because
 * those references depend on runtime context the plugin doesn't carry at
 * translation time.
 *
 * When the template variable is the WHOLE string literal
 * (`"{{global.variables.token}}"`), the surrounding quotes are dropped so
 * we don't end up with `"configuration.getFieldValue(...)"` (double-stringified).
 */
export function substituteTemplateVariables(code: string): SubstituteResult {
  let substitutions = 0;
  const unresolved: string[] = [];

  // First pass: replace the quoted-whole-literal form to avoid leaving
  // `"<getter>"` strings.
  let out = code.replace(
    /"\{\{global\.variables\.([^}]+)\}\}"/g,
    (_match, fieldName: string) => {
      substitutions++;
      return `configuration.getFieldValue("${fieldName.trim()}")`;
    },
  );
  out = out.replace(
    /'\{\{global\.variables\.([^}]+)\}\}'/g,
    (_match, fieldName: string) => {
      substitutions++;
      return `configuration.getFieldValue("${fieldName.trim()}")`;
    },
  );

  // Second pass: every remaining `{{...}}` fragments (mid-string concat or
  // local/flow vars). For globals we still emit the getter inline; for
  // local/flow we leave a TODO marker.
  out = out.replace(TEMPLATE_VAR_REGEX, (_match, raw: string) => {
    const path = raw.trim();
    if (path.startsWith("global.variables.")) {
      const field = path.slice("global.variables.".length);
      substitutions++;
      return `configuration.getFieldValue("${field}")`;
    }
    if (path.startsWith("local.")) {
      unresolved.push(path);
      return `/* TODO local var: ${path} */`;
    }
    if (path.startsWith("flow.")) {
      unresolved.push(path);
      return `/* TODO flow var: ${path} */`;
    }
    if (path.startsWith("global.")) {
      unresolved.push(path);
      return `/* TODO global var: ${path} */`;
    }
    unresolved.push(path);
    return `/* TODO var: ${path} */`;
  });

  return { code: out, substitutions, unresolved };
}

// ──────────────────────────────────────────────────────────────────────────────

export interface TranslationResult {
  javaBody: string;
  partial: boolean;
  warnings: string[];
  /** How many `{{global.variables.X}}` were translated into getter calls. */
  substitutionsCount: number;
  /** Variable paths that need runtime context (local/flow). */
  unresolvedVars: string[];
}

const INDENT = "        "; // 8 spaces — matches plugin template's main method body.

function escapeJavaCommentClose(s: string): string {
  // Block comments end at `*/`. Inside our preserved JS-as-comment block
  // we replace `*/` with `* /` so the surrounding `/* ... */` doesn't close
  // prematurely. The whitespace is harmless inside the comment.
  return s.replace(/\*\//g, "* /");
}

function indentBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? INDENT + line : line))
    .join("\n");
}

function detectUnsupported(code: string): string[] {
  const warnings: string[] = [];
  for (const { regex, reason } of UNSUPPORTED_PATTERNS) {
    if (regex.test(code)) warnings.push(reason);
  }
  return warnings;
}

/** translateDaVinciToJavaBody — auto-generated description placeholder. */
export function translateDaVinciToJavaBody(code: string): TranslationResult {
  if (!code || !code.trim()) {
    return {
      javaBody:
        `${INDENT}// empty or no DaVinci body — operator must implement\n` +
        `${INDENT}log.info("DaVinci plugin invoked (stub body)");\n` +
        `${INDENT}return null;`,
      partial: true,
      warnings: ["empty input"],
      substitutionsCount: 0,
      unresolvedVars: [],
    };
  }

  const extracted = extractFunctionBody(code);
  const substituted = substituteTemplateVariables(extracted.body);
  const unsupported = detectUnsupported(extracted.body);

  // Build the Java body. Conservative MVP: log + comment-preserved original
  // + a stub return. The operator finishes the translation by hand using the
  // preserved JS as reference. partial=true always — full JS→Java is out of
  // MVP scope.
  const lines: string[] = [];
  lines.push(`// === Generated by DaVinci → Java translator (MVP, partial) ===`);
  lines.push(`log.info("DaVinci plugin invoked — ${substituted.substitutions} variable(s) bound");`);
  lines.push("");

  if (substituted.substitutions > 0) {
    lines.push(`// DaVinci global variables resolved via configuration.getFieldValue():`);
    lines.push(`// (see preserved body below)`);
    lines.push("");
  }

  if (unsupported.length > 0) {
    lines.push(`// PARTIAL TRANSLATION — the original body uses constructs that need manual review:`);
    for (const wVar of unsupported) lines.push(`//   - ${wVar}`);
    lines.push("");
  }

  // Preserve the substituted body as a Java block comment so the operator
  // can finish the translation. `*/` is escaped so the comment can't close
  // prematurely.
  const preserved = escapeJavaCommentClose(substituted.code);
  lines.push("/* Original DaVinci body (with global vars substituted):");
  lines.push(preserved);
  lines.push("*/");
  lines.push("");
  lines.push(`return null; // operator: replace with translated logic above`);

  const indented = lines.map((line) => (line.length > 0 ? INDENT + line : line)).join("\n");
  void indentBlock;

  return {
    javaBody: indented,
    partial: true,
    warnings: unsupported,
    substitutionsCount: substituted.substitutions,
    unresolvedVars: substituted.unresolved,
  };
}
