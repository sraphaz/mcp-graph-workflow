/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 3.1: heal engine (pure, deterministic)
 *
 * Identifies broken Playwright spec steps, patches only the failing step,
 * and enforces the dupla-data (double-data) criterion before accepting a
 * new selector. All logic here is deterministic — no LLM, no FS, no CDP.
 * Callers inject the StepExecutor to keep this module boundary-free.
 */

import type { Recipe } from "../../schemas/recipe.schema.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StepBlock {
  /** First line of the step block (0-based, inclusive). */
  start: number;
  /** Last line of the step block — the toHaveScreenshot line (0-based, inclusive). */
  end: number;
}

export type StepExecutorResult =
  | { ok: true; newSelector: string }
  | { ok: false; error: string };

export type StepExecutor = (stepIndex: number, recipe: Recipe) => Promise<StepExecutorResult>;

export type HealOutcome =
  | { kind: "healed"; patchedSpec: string; stepIndex: number }
  | { kind: "retry_needed"; patchedSpec: string; stepIndex: number }
  | { kind: "broken_unhealed"; stepIndex: number; error: string };

// ---------------------------------------------------------------------------
// identifyBrokenStep
// ---------------------------------------------------------------------------

/**
 * Extracts the broken step index (1-based) from a Playwright error string.
 * Matches the `step-N.png` screenshot reference embedded in error output.
 */
export function identifyBrokenStep(playwrightError: string): number | null {
  const m = playwrightError.match(/step-(\d+)\.png/);
  return m ? parseInt(m[1], 10) : null;
}

// ---------------------------------------------------------------------------
// locateStepBlock
// ---------------------------------------------------------------------------

/**
 * Finds the line range [start..end] (inclusive, 0-based) of step N in a
 * generated Playwright spec. The end line is always the `step-N.png`
 * toHaveScreenshot call. The start line is the line immediately after the
 * previous step's screenshot, or after the test-function opening brace for
 * step 1.
 */
export function locateStepBlock(lines: string[], stepIndex: number): StepBlock | null {
  const ssRe = new RegExp(`step-${stepIndex}\\.png`);
  const end = lines.findIndex((l) => ssRe.test(l));
  if (end === -1) return null;

  let start: number;
  if (stepIndex === 1) {
    // Start from the line after the `async ({ page }) => {` test-opening line
    const openIdx = lines.findIndex((l) => /async\s*\(\s*\{\s*page\s*\}/.test(l));
    start = openIdx === -1 ? 0 : openIdx + 1;
  } else {
    const prevSsRe = new RegExp(`step-${stepIndex - 1}\\.png`);
    const prevEnd = lines.findIndex((l) => prevSsRe.test(l));
    start = prevEnd === -1 ? 0 : prevEnd + 1;
  }

  return { start, end };
}

// ---------------------------------------------------------------------------
// patchStepSelector
// ---------------------------------------------------------------------------

// Matches the first quoted string argument in page.click/fill/locator/waitForSelector calls.
const ACTION_CALL_RE = /\bpage\.(click|fill|locator|waitForSelector)\b/;
const FIRST_QUOTED_ARG_RE = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/;

/**
 * Returns a new spec content where only the CSS selector in step N's action
 * line is replaced with `newSelector`. Lines outside the step block are
 * byte-for-byte identical to the original. Returns the original content
 * unchanged when step N has no patchable selector (e.g. navigate).
 */
export function patchStepSelector(
  specContent: string,
  stepIndex: number,
  newSelector: string,
): string {
  const lines = specContent.split("\n");
  const block = locateStepBlock(lines, stepIndex);
  if (!block) return specContent;

  for (let i = block.start; i < block.end; i++) {
    const line = lines[i];
    if (ACTION_CALL_RE.test(line) && FIRST_QUOTED_ARG_RE.test(line)) {
      lines[i] = line.replace(FIRST_QUOTED_ARG_RE, `'${newSelector}'`);
      return lines.join("\n");
    }
  }

  // No patchable selector found (e.g. navigate step) — return unchanged
  return specContent;
}

// ---------------------------------------------------------------------------
// patchStepRetryNeeded
// ---------------------------------------------------------------------------

/**
 * Inserts a `// @harness:retry-needed` comment immediately before the
 * screenshot assertion of step N, keeping the original selector intact.
 * Leaves all other lines unchanged (surgical-changes §3).
 */
export function patchStepRetryNeeded(specContent: string, stepIndex: number): string {
  const lines = specContent.split("\n");
  const block = locateStepBlock(lines, stepIndex);
  if (!block) return specContent;

  // Detect indentation from the screenshot line
  const ssLine = lines[block.end];
  const indent = ssLine.match(/^(\s*)/)?.[1] ?? "  ";
  lines.splice(block.end, 0, `${indent}// @harness:retry-needed`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// checkDoubleData
// ---------------------------------------------------------------------------

/**
 * Verifies that `selector` is present in BOTH `evidenceBefore` and
 * `evidenceAfter` DOM snapshots. This "double-data" criterion prevents
 * accepting a selector that works on only one DOM state.
 *
 * Supports simple CSS selectors: `#id`, `.class`, and plain strings.
 */
export function checkDoubleData(
  selector: string,
  evidenceBefore: string,
  evidenceAfter: string,
): boolean {
  let token: string;
  if (selector.startsWith("#")) {
    token = `id="${selector.slice(1)}"`;
  } else if (selector.startsWith(".")) {
    token = selector.slice(1); // class name substring
  } else {
    token = selector;
  }
  return evidenceBefore.includes(token) && evidenceAfter.includes(token);
}

// ---------------------------------------------------------------------------
// runHeal — orchestration
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full heal cycle for a single broken spec.
 *
 * 1. Identifies the broken step N from the Playwright error.
 * 2. Calls `executor(N, recipe)` to re-run only step N via CDP (injected).
 * 3. If executor succeeds: checks double-data criterion.
 *    - Passes → patches spec with new selector → `healed`
 *    - Fails → appends retry-needed comment → `retry_needed`
 * 4. If executor fails → returns `broken_unhealed` without touching spec.
 */
export async function runHeal(
  specContent: string,
  recipe: Recipe,
  playwrightError: string,
  executor: StepExecutor,
): Promise<HealOutcome> {
  const stepIndex = identifyBrokenStep(playwrightError);
  if (stepIndex === null) {
    return { kind: "broken_unhealed", stepIndex: -1, error: "could not identify broken step from error text" };
  }

  const result = await executor(stepIndex, recipe);

  if (!result.ok) {
    return { kind: "broken_unhealed", stepIndex, error: result.error };
  }

  // Step executed successfully — check the double-data criterion
  const recipeStep = recipe.steps[stepIndex - 1]; // 1-based → 0-based
  const passesDoubleData = recipeStep
    ? checkDoubleData(result.newSelector, recipeStep.evidence_before, recipeStep.evidence_after)
    : false;

  if (passesDoubleData) {
    const patchedSpec = patchStepSelector(specContent, stepIndex, result.newSelector);
    return { kind: "healed", patchedSpec, stepIndex };
  }

  const patchedSpec = patchStepRetryNeeded(specContent, stepIndex);
  return { kind: "retry_needed", patchedSpec, stepIndex };
}
