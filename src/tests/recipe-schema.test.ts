/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Schema recipe.json Zod
 *
 * AC1: GIVEN run verde WHEN materializa THEN gera recipe.json Zod-validated
 * AC2: GIVEN step click no recipe WHEN inspecionado THEN tem selector OR coords, evidências, assert
 * AC3: GIVEN run com step sem evidência WHEN tenta materializar THEN falha
 */

import { describe, it, expect } from "vitest";
import { RecipeSchema, RecipeStepSchema, type Recipe, type RecipeStep } from "../schemas/recipe.schema.js";

// ---------------------------------------------------------------------------
// AC1: valid recipe parses successfully
// ---------------------------------------------------------------------------

describe("RecipeSchema — AC1: valid recipe parses", () => {
  it("accepts a minimal valid recipe with one navigate step", () => {
    const recipe = {
      runId: "run-001",
      createdAt: Date.now(),
      steps: [
        {
          kind: "navigate",
          payload: "https://example.com",
          evidence_before: "screenshot-before.png",
          evidence_after: "screenshot-after.png",
        },
      ],
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(true);
  });

  it("rejects a recipe with no steps", () => {
    const result = RecipeSchema.safeParse({
      runId: "run-001",
      createdAt: Date.now(),
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it("infers correct TypeScript type from schema", () => {
    const step: RecipeStep = {
      kind: "navigate",
      payload: "https://example.com",
      evidence_before: "before.png",
      evidence_after: "after.png",
    };
    const recipe: Recipe = {
      runId: "r1",
      createdAt: 1000,
      steps: [step],
    };
    expect(recipe.steps).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC2: click step has selector OR coords, evidências, assert_after
// ---------------------------------------------------------------------------

describe("RecipeStepSchema — AC2: click step fields", () => {
  it("accepts click step with selector", () => {
    const result = RecipeStepSchema.safeParse({
      kind: "click",
      selector: "#submit-btn",
      evidence_before: "before.png",
      evidence_after: "after.png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts click step with coords instead of selector", () => {
    const result = RecipeStepSchema.safeParse({
      kind: "click",
      coords: { x: 100, y: 200 },
      evidence_before: "before.png",
      evidence_after: "after.png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts click step with optional assert_after", () => {
    const result = RecipeStepSchema.safeParse({
      kind: "click",
      selector: "#btn",
      evidence_before: "before.png",
      evidence_after: "after.png",
      assert_after: { type: "visible", selector: "#result" },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.assert_after).toBeDefined();
  });

  it("accepts type step with selector and payload", () => {
    const result = RecipeStepSchema.safeParse({
      kind: "type",
      selector: "#input",
      payload: "hello world",
      evidence_before: "before.png",
      evidence_after: "after.png",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3: step without evidence_before OR evidence_after fails
// ---------------------------------------------------------------------------

describe("RecipeStepSchema — AC3: evidence required", () => {
  it("rejects step missing evidence_before", () => {
    const result = RecipeStepSchema.safeParse({
      kind: "click",
      selector: "#btn",
      evidence_after: "after.png",
      // no evidence_before
    });
    expect(result.success).toBe(false);
  });

  it("rejects step missing evidence_after", () => {
    const result = RecipeStepSchema.safeParse({
      kind: "click",
      selector: "#btn",
      evidence_before: "before.png",
      // no evidence_after
    });
    expect(result.success).toBe(false);
  });

  it("rejects step with empty string as evidence", () => {
    const result = RecipeStepSchema.safeParse({
      kind: "navigate",
      payload: "https://example.com",
      evidence_before: "",
      evidence_after: "after.png",
    });
    expect(result.success).toBe(false);
  });
});
