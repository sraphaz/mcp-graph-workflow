/**
 * SourceTextExtractor — enriches ParsedConstruct[] with sourceText
 * by slicing original source code using startLine/endLine.
 *
 * For block constructs (functions, classes, if/else, loops, try/catch),
 * detects block boundaries using language-family-specific strategies:
 * - Brace languages: scan forward counting {/} with string/comment escaping
 * - Indent languages: scan until indentation drops (future)
 * - Keyword-end languages: scan until `end` keyword (future)
 *
 * For single-line constructs (return, import, throw, break, variable decl),
 * extracts just the line.
 */

import type { ParsedConstruct } from "../parsers/parser-adapter.js";

// ── Language Families ─────────────────────────────

const BRACE_LANGUAGES = new Set([
  "typescript", "javascript", "java", "go", "rust", "csharp",
  "cpp", "php", "swift", "kotlin", "scala", "dart",
]);

const INDENT_LANGUAGES = new Set(["python", "haskell"]);

const KEYWORD_END_LANGUAGES = new Set(["ruby", "lua", "elixir"]);

/** Construct IDs that are always single-line (no block body). */
const SINGLE_LINE_CONSTRUCTS = new Set([
  "uc_return", "uc_break", "uc_continue", "uc_throw",
  "uc_import_named", "uc_import_default", "uc_import_namespace",
  "uc_export_named", "uc_export_default",
  "uc_const_decl", "uc_let_decl", "uc_var_decl", "uc_assign",
  "uc_fn_call", "uc_await", "uc_promise_all",
  "uc_arr_map", "uc_arr_filter", "uc_arr_reduce", "uc_arr_push", "uc_arr_includes",
  "uc_obj_keys", "uc_nullish", "uc_optional_chain", "uc_spread",
  "uc_destruct_obj", "uc_destruct_arr", "uc_template_lit",
  "uc_type_alias", "uc_type_enum", "uc_type_generic",
  "uc_default_param", "uc_rest_param",
  "uc_property", "uc_extends", "uc_implements",
]);

// ── Public API ────────────────────────────────────

/**
 * Enrich ParsedConstruct[] with sourceText extracted from sourceCode.
 * Returns a NEW array — does not mutate the input constructs.
 */
export function extractSourceText(
  sourceCode: string,
  constructs: ParsedConstruct[],
  languageId: string,
): ParsedConstruct[] {
  const lines = sourceCode.split("\n");

  return constructs.map((c) => {
    const sourceText = extractForConstruct(lines, c, languageId);
    return { ...c, sourceText };
  });
}

// ── Internal ──────────────────────────────────────

function extractForConstruct(
  lines: string[],
  construct: ParsedConstruct,
  languageId: string,
): string {
  const startIdx = construct.startLine - 1; // 0-based
  if (startIdx < 0 || startIdx >= lines.length) {
    return lines[Math.max(0, Math.min(startIdx, lines.length - 1))] ?? "";
  }

  // Single-line constructs: just return the line
  if (SINGLE_LINE_CONSTRUCTS.has(construct.constructId)) {
    return lines[startIdx];
  }

  // Block constructs: detect end based on language family
  if (BRACE_LANGUAGES.has(languageId)) {
    return extractBraceBlock(lines, startIdx);
  }

  if (INDENT_LANGUAGES.has(languageId)) {
    return extractIndentBlock(lines, startIdx);
  }

  if (KEYWORD_END_LANGUAGES.has(languageId)) {
    return extractKeywordEndBlock(lines, startIdx);
  }

  // Fallback: use startLine to endLine
  const endIdx = Math.min(construct.endLine - 1, lines.length - 1);
  return lines.slice(startIdx, endIdx + 1).join("\n");
}

/**
 * Extract a brace-delimited block starting from startIdx.
 * Scans forward counting { and } with string/comment escaping.
 * Returns lines from startIdx to the line containing the matching closing brace.
 */
function extractBraceBlock(lines: string[], startIdx: number): string {
  let depth = 0;
  let foundOpen = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const braceChange = countBraceChange(line);
    depth += braceChange;

    if (braceChange > 0 || depth > 0) {
      foundOpen = true;
    }

    // If we opened a brace and depth returned to 0, we found the closing
    if (foundOpen && depth <= 0) {
      return lines.slice(startIdx, i + 1).join("\n");
    }
  }

  // If no braces found at all (single-line statement), return just the start line
  if (!foundOpen) {
    return lines[startIdx];
  }

  // Unclosed brace: return from start to end of file
  return lines.slice(startIdx).join("\n");
}

/**
 * Count net brace change in a line, ignoring braces inside strings and comments.
 */
function countBraceChange(line: string): number {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "";

    // Skip escaped characters
    if (prev === "\\") continue;

    // Toggle string states
    if (ch === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (ch === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (ch === "`" && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
      continue;
    }

    // Skip if inside any string
    if (inSingleQuote || inDoubleQuote || inBacktick) continue;

    // Line comment: stop processing rest of line
    if (ch === "/" && i + 1 < line.length && line[i + 1] === "/") {
      break;
    }

    // Count braces
    if (ch === "{") depth++;
    if (ch === "}") depth--;
  }

  return depth;
}

/**
 * Extract an indent-delimited block (Python, Haskell).
 * Scans forward from startIdx until indentation drops below the construct level.
 */
function extractIndentBlock(lines: string[], startIdx: number): string {
  const startLine = lines[startIdx];
  const baseIndent = getIndentLevel(startLine);

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip blank lines
    if (line.trim() === "") continue;

    const indent = getIndentLevel(line);
    if (indent <= baseIndent) {
      // This line is at or below base indent — block ends at previous line
      return lines.slice(startIdx, i).join("\n");
    }
  }

  // Block extends to end of file
  return lines.slice(startIdx).join("\n");
}

/**
 * Extract a keyword-end block (Ruby, Lua, Elixir).
 * Scans forward from startIdx until matching `end` keyword at base indent.
 */
function extractKeywordEndBlock(lines: string[], startIdx: number): string {
  const baseIndent = getIndentLevel(lines[startIdx]);

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "end" && getIndentLevel(line) <= baseIndent) {
      return lines.slice(startIdx, i + 1).join("\n");
    }
  }

  // No matching end found — return to end of file
  return lines.slice(startIdx).join("\n");
}

/** Get indentation level (number of leading spaces; tabs count as 4). */
function getIndentLevel(line: string): number {
  let level = 0;
  for (const ch of line) {
    if (ch === " ") level++;
    else if (ch === "\t") level += 4;
    else break;
  }
  return level;
}
