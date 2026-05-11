/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 3.1: heal engine unit tests (TDD RED)
 *
 * AC1: re-executa só step N (não fluxo inteiro)
 * AC2: diff toca ≤1 step do spec.ts + linha equivalente do recipe
 * AC3: nenhuma outra parte tocada (surgical-changes §3)
 * AC4: selector novo sem dupla-data → mantém antigo + `// @harness:retry-needed`
 * AC5: heal falha → outcome broken_unhealed, spec intocado
 */

import { describe, it, expect } from "vitest";
import {
  identifyBrokenStep,
  locateStepBlock,
  patchStepSelector,
  patchStepRetryNeeded,
  checkDoubleData,
  runHeal,
} from "../core/browser-harness/heal-engine.js";
import type { StepExecutor } from "../core/browser-harness/heal-engine.js";
import type { Recipe } from "../schemas/recipe.schema.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_SPEC = [
  "// @generated-from runId=run123 on 2026-01-01 for feature=run123",
  "",
  "import { test, expect } from '@playwright/test';",
  "",
  "test('generated from run123', async ({ page }) => {",
  "  await page.goto('https://example.com');",
  "  await expect(page).toHaveScreenshot('run123-step-1.png');",
  "  await page.click('#old-btn');",
  "  await expect(page).toHaveScreenshot('run123-step-2.png');",
  "  await page.fill('#input', 'hello');",
  "  await expect(page).toHaveScreenshot('run123-step-3.png');",
  "});",
  "",
].join("\n");

const BEFORE_HTML = '<div id="root"><button class="new-btn">Click</button></div>';
const AFTER_HTML = '<div id="root"><span><button class="new-btn">Clicked</button></span></div>';

function makeRecipe(): Recipe {
  return {
    runId: "run123",
    createdAt: Date.now(),
    steps: [
      { kind: "navigate", payload: "https://example.com", evidence_before: "<div/>", evidence_after: "<div/>" },
      { kind: "click", selector: "#old-btn", evidence_before: BEFORE_HTML, evidence_after: AFTER_HTML },
      { kind: "type", selector: "#input", payload: "hello", evidence_before: "<div/>", evidence_after: "<div/>" },
    ],
  };
}

// ---------------------------------------------------------------------------
// identifyBrokenStep
// ---------------------------------------------------------------------------

describe("identifyBrokenStep", () => {
  it("returns step index from screenshot reference in error text", () => {
    expect(identifyBrokenStep("Error: run123-step-2.png snapshot differs")).toBe(2);
  });

  it("returns step index when error mentions step-N.png inline", () => {
    const err = "locator.click: No element found\n  at toHaveScreenshot('run123-step-3.png')";
    expect(identifyBrokenStep(err)).toBe(3);
  });

  it("returns null when no step-N.png reference present", () => {
    expect(identifyBrokenStep("Timeout exceeded")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// locateStepBlock — AC1: só step N, não fluxo inteiro
// ---------------------------------------------------------------------------

describe("locateStepBlock (AC1)", () => {
  it("returns a block that contains step-1.png but not step-2 or step-3", () => {
    const lines = SAMPLE_SPEC.split("\n");
    const block = locateStepBlock(lines, 1);
    expect(block).not.toBeNull();
    const blockText = lines.slice(block!.start, block!.end + 1).join("\n");
    expect(blockText).toContain("step-1.png");
    expect(blockText).not.toContain("step-2.png");
    expect(blockText).not.toContain("step-3.png");
  });

  it("returns a block that contains step-2.png but not step-1 or step-3", () => {
    const lines = SAMPLE_SPEC.split("\n");
    const block = locateStepBlock(lines, 2);
    expect(block).not.toBeNull();
    const blockText = lines.slice(block!.start, block!.end + 1).join("\n");
    expect(blockText).toContain("step-2.png");
    expect(blockText).not.toContain("step-1.png");
    expect(blockText).not.toContain("step-3.png");
  });

  it("returns null for a step index that does not exist", () => {
    const lines = SAMPLE_SPEC.split("\n");
    expect(locateStepBlock(lines, 99)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// patchStepSelector — AC2: diff toca ≤1 step
// ---------------------------------------------------------------------------

describe("patchStepSelector (AC2)", () => {
  it("replaces the selector in step 2 and leaves step 1 and step 3 unchanged", () => {
    const patched = patchStepSelector(SAMPLE_SPEC, 2, "#new-btn");
    expect(patched).toContain("#new-btn");
    expect(patched).not.toContain("#old-btn");
    // Step 1 action untouched
    expect(patched).toContain("page.goto('https://example.com')");
    // Step 3 action untouched
    expect(patched).toContain("page.fill('#input', 'hello')");
  });

  // AC3: linhas fora do bloco N são byte-a-byte idênticas
  it("AC3: lines outside step N block are unchanged", () => {
    const patched = patchStepSelector(SAMPLE_SPEC, 2, "#new-btn");
    const orig = SAMPLE_SPEC.split("\n");
    const patc = patched.split("\n");
    const step1SsIdx = orig.findIndex((l) => l.includes("step-1.png"));
    const step3SsIdx = orig.findIndex((l) => l.includes("step-3.png"));
    expect(patc[step1SsIdx]).toBe(orig[step1SsIdx]);
    expect(patc[step3SsIdx]).toBe(orig[step3SsIdx]);
  });

  it("returns spec unchanged when step N has no patchable selector (e.g. navigate)", () => {
    const patched = patchStepSelector(SAMPLE_SPEC, 1, "#irrelevant");
    expect(patched).toBe(SAMPLE_SPEC);
  });
});

// ---------------------------------------------------------------------------
// patchStepRetryNeeded — AC4: retry-needed comment
// ---------------------------------------------------------------------------

describe("patchStepRetryNeeded (AC4)", () => {
  it("adds // @harness:retry-needed near step 2 block without touching step 1 or 3", () => {
    const patched = patchStepRetryNeeded(SAMPLE_SPEC, 2);
    expect(patched).toContain("@harness:retry-needed");
    // Old selector must still be present (spec not changed)
    expect(patched).toContain("#old-btn");
    // Comment must be in the neighbourhood of step-2.png
    const lines = patched.split("\n");
    const commentIdx = lines.findIndex((l) => l.includes("@harness:retry-needed"));
    const ss2Idx = lines.findIndex((l) => l.includes("step-2.png"));
    expect(Math.abs(commentIdx - ss2Idx)).toBeLessThanOrEqual(2);
  });

  it("adjacent step screenshot lines are untouched", () => {
    const patched = patchStepRetryNeeded(SAMPLE_SPEC, 2);
    const origLines = SAMPLE_SPEC.split("\n");
    const patchedLines = patched.split("\n");
    const orig1 = origLines.find((l) => l.includes("step-1.png"))!;
    const orig3 = origLines.find((l) => l.includes("step-3.png"))!;
    expect(patchedLines.some((l) => l === orig1)).toBe(true);
    expect(patchedLines.some((l) => l === orig3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkDoubleData — AC4: critério dupla-data
// ---------------------------------------------------------------------------

describe("checkDoubleData (AC4 double-data criterion)", () => {
  it("returns true when class selector appears in both evidence snapshots", () => {
    expect(checkDoubleData(".new-btn", BEFORE_HTML, AFTER_HTML)).toBe(true);
  });

  it("returns false when selector found in only one snapshot", () => {
    const noAfter = '<div id="root"><p>Done</p></div>';
    expect(checkDoubleData(".new-btn", BEFORE_HTML, noAfter)).toBe(false);
  });

  it("returns false when selector appears in neither snapshot", () => {
    expect(checkDoubleData(".ghost", BEFORE_HTML, AFTER_HTML)).toBe(false);
  });

  it("supports id selector #btn", () => {
    const before = '<button id="submit">OK</button>';
    const after = '<button id="submit" disabled>OK</button>';
    expect(checkDoubleData("#submit", before, after)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runHeal — AC1 + AC4 + AC5 integration
// ---------------------------------------------------------------------------

describe("runHeal", () => {
  const recipe = makeRecipe();

  // AC1: re-executa só step N
  it("AC1: calls executor only for the broken step index", async () => {
    const called: number[] = [];
    const executor: StepExecutor = async (idx) => {
      called.push(idx);
      return { ok: true, newSelector: ".new-btn" };
    };
    await runHeal(SAMPLE_SPEC, recipe, "Error: run123-step-2.png differs", executor);
    expect(called).toEqual([2]);
  });

  // AC4: double-data fails → retry_needed
  it("AC4: returns retry_needed when executor succeeds but double-data fails", async () => {
    const executor: StepExecutor = async () => ({ ok: true, newSelector: ".ghost" });
    const result = await runHeal(SAMPLE_SPEC, recipe, "Error: run123-step-2.png differs", executor);
    expect(result.kind).toBe("retry_needed");
    if (result.kind === "retry_needed") {
      expect(result.patchedSpec).toContain("@harness:retry-needed");
      expect(result.patchedSpec).toContain("#old-btn"); // selector unchanged
    }
  });

  // AC4: double-data passes → healed
  it("AC4: returns healed when executor succeeds and double-data passes", async () => {
    const executor: StepExecutor = async () => ({ ok: true, newSelector: ".new-btn" });
    const result = await runHeal(SAMPLE_SPEC, recipe, "Error: run123-step-2.png differs", executor);
    expect(result.kind).toBe("healed");
    if (result.kind === "healed") {
      expect(result.patchedSpec).toContain(".new-btn");
      expect(result.patchedSpec).not.toContain("#old-btn");
    }
  });

  // AC5: executor falha → broken_unhealed, spec intocado
  it("AC5: returns broken_unhealed when executor fails, spec untouched", async () => {
    const executor: StepExecutor = async () => ({ ok: false, error: "element not found" });
    const result = await runHeal(SAMPLE_SPEC, recipe, "Error: run123-step-2.png differs", executor);
    expect(result.kind).toBe("broken_unhealed");
    if (result.kind === "broken_unhealed") {
      expect(result.error).toContain("element not found");
      expect(result.stepIndex).toBe(2);
    }
  });

  // AC5: spec must not be modified when broken_unhealed
  it("AC5: spec content is untouched on broken_unhealed", async () => {
    const executor: StepExecutor = async () => ({ ok: false, error: "timeout" });
    const result = await runHeal(SAMPLE_SPEC, recipe, "Error: run123-step-2.png differs", executor);
    expect(result.kind).toBe("broken_unhealed");
    // No patchedSpec field on broken_unhealed — spec is the caller's responsibility
  });

  it("returns broken_unhealed when error has no recognisable step reference", async () => {
    const executor: StepExecutor = async () => ({ ok: true, newSelector: ".x" });
    const result = await runHeal(SAMPLE_SPEC, recipe, "generic timeout error", executor);
    expect(result.kind).toBe("broken_unhealed");
  });
});
