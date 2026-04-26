/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Regex helpers ported from tools/feature-depth/analyzer/depth.go.
 *
 * Canonical implementation lives in Go (used by standalone audit + CI
 * dashboards). This TS port is the lifecycle hot-path version called
 * from finish_task — same regexes, same calibration constants, evaluated
 * over file content as a string.
 *
 * If you change anything here, update the Go file in lockstep.
 */

// ── Type safety patterns ──────────────────────────────────────────────
const ANY_TYPE_RE = /:\s*any\b/g;
const AS_ANY_RE = /\bas\s+any\b/g;

// ── Error handling ────────────────────────────────────────────────────
const TYPED_ERROR_RE = /new\s+\w+Error\(/g;
const RAW_ERROR_RE = /new\s+Error\(/g;
const TRY_CATCH_RE = /\btry\s*\{/g;
const CATCH_BLOCK_RE = /\bcatch\s*\(/g;

// ── Validation (Zod) ──────────────────────────────────────────────────
const ZOD_USAGE_RE = /z\.\w+\(/g;
const PARSE_CALL_RE = /\.parse\(/g;
const SAFE_PARSE_RE = /\.safeParse\(/g;

// ── Edge cases / defensive programming ────────────────────────────────
const GUARD_CLAUSE_RE = /if\s*\([^)]*\)\s*(return|throw)\b/g;
const NULLISH_COAL_RE = /\?\?/g;
const OPTIONAL_CHAIN_RE = /\?\./g;
const DEFAULT_BRANCH_RE = /\bdefault\s*:/g;

// ── Function detection (used by typeSafety + edgeCases denominators) ──
const FUNC_SIGNATURE_RE = /(function\s+\w+|=>\s*\{|\w+\s*\([^)]*\)\s*[:{])/g;
const EXPLICIT_RETURN_RE = /\)\s*:\s*\w+/g;

function countMatches(re: RegExp, content: string): number {
  // Each call needs a fresh lastIndex since these are /g.
  re.lastIndex = 0;
  return content.match(re)?.length ?? 0;
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * 0-100. Typed errors (FooError extends Error) score higher than raw
 * `new Error()`. Catch blocks add a coverage bonus. Files with no
 * error-related code at all return 50 (neutral).
 */
export function calcErrorHandling(content: string): number {
  const typed = countMatches(TYPED_ERROR_RE, content);
  const raw = countMatches(RAW_ERROR_RE, content);
  const tryCatch = countMatches(TRY_CATCH_RE, content);
  const catches = countMatches(CATCH_BLOCK_RE, content);

  const totalErrors = typed + raw;
  if (totalErrors === 0 && tryCatch === 0) return 50.0;

  let typedRatio = 0;
  if (totalErrors > 0) typedRatio = typed / totalErrors;

  const catchBonus = catches > 0 ? 25.0 : 0;
  return clamp(typedRatio * 75.0 + catchBonus, 0, 100);
}

/**
 * 0-100. Lower `any` usage = higher score. Explicit return types
 * give a coverage bonus.
 */
export function calcTypeSafety(content: string): number {
  const anyCount = countMatches(ANY_TYPE_RE, content) + countMatches(AS_ANY_RE, content);
  const funcSigs = countMatches(FUNC_SIGNATURE_RE, content);
  const explicitReturns = countMatches(EXPLICIT_RETURN_RE, content);

  if (funcSigs === 0) {
    return anyCount === 0 ? 100.0 : 50.0;
  }

  let anyPenalty = anyCount * 5.0;
  if (anyPenalty > 50) anyPenalty = 50;

  let returnRatio = explicitReturns / funcSigs;
  if (returnRatio > 1) returnRatio = 1;

  return clamp(100.0 - anyPenalty + returnRatio * 20.0 - 20.0, 0, 100);
}

/**
 * 0-100. Counts Zod schema definitions + parse/safeParse calls.
 * Diminishing returns at high counts.
 */
export function calcValidation(content: string): number {
  const zodCalls = countMatches(ZOD_USAGE_RE, content);
  const parseCalls = countMatches(PARSE_CALL_RE, content);
  const safeParse = countMatches(SAFE_PARSE_RE, content);

  const total = zodCalls + parseCalls + safeParse;
  if (total === 0) return 0;

  return clamp(total * 5.0, 0, 100);
}

/**
 * 0-100. Guard clauses, nullish coalescing, optional chaining, and
 * switch defaults — all signs of defensive programming. Normalized
 * by approximate function count.
 */
export function calcEdgeCases(content: string): number {
  const guards = countMatches(GUARD_CLAUSE_RE, content);
  const nullish = countMatches(NULLISH_COAL_RE, content);
  const optional = countMatches(OPTIONAL_CHAIN_RE, content);
  const defaults = countMatches(DEFAULT_BRANCH_RE, content);

  const total = guards + nullish + optional + defaults;
  if (total === 0) return 0;

  let funcCount = countMatches(FUNC_SIGNATURE_RE, content);
  if (funcCount === 0) funcCount = 1;

  const ratio = total / funcCount;
  return clamp(ratio * 30.0, 0, 100);
}

// Internal — exported for testing only.
export const _internals = { clamp, countMatches };
