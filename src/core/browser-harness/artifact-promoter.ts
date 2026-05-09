/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 1.3: passed → artifact promotion.
 *
 * When a HarnessRun verdict is "pass" AND all step results have non-null
 * screenshotPath (evidence gate), writes:
 *   <artifactsDir>/<runId>/spec.ts          — standalone Playwright test
 *   <artifactsDir>/<runId>/recipe.json      — neutral recipe
 *   <artifactsDir>/<runId>/evidences/       — placeholder dir
 *   <artifactsDir>/manifest.json            — updated with entry
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HarnessRun } from "../../schemas/browser-harness.schema.js";
import type { Recipe, RecipeStep } from "../../schemas/recipe.schema.js";
import { generatePlaywrightSpec } from "./playwright-generator.js";

export interface PromoteOptions {
  /** Root directory for all artifacts (e.g. browser-tests/artifacts/). */
  artifactsDir: string;
  /** Optional feature slug override; defaults to run.nodeId ?? run.id. */
  featureSlug?: string;
}

export interface PromoteResult {
  written: boolean;
  specPath?: string;
  recipePath?: string;
  artifactDir?: string;
  reason?: string;
}

interface ManifestEntry {
  runId: string;
  nodeId: string | null;
  featureSlug: string;
  promotedAt: number;
  specPath: string;
}

function hasCompleteEvidence(run: HarnessRun): boolean {
  return run.results.every((r) => r.screenshotPath !== null);
}

function buildRecipe(run: HarnessRun): Recipe {
  const steps: RecipeStep[] = run.results.map((result, i) => {
    const planned = run.plan[i];
    const args = planned?.args ?? {};
    const payload = typeof args["url"] === "string" ? args["url"]
      : typeof args["text"] === "string" ? args["text"]
      : typeof args["value"] === "string" ? args["value"]
      : undefined;
    const selector = typeof args["selector"] === "string" ? args["selector"] : undefined;

    return {
      kind: "assert" as const,
      selector,
      payload,
      evidence_before: result.screenshotPath ?? "missing.png",
      evidence_after: result.screenshotPath ?? "missing.png",
    };
  });

  return {
    runId: run.id,
    createdAt: run.createdAt,
    steps: steps.length > 0 ? steps : [
      {
        kind: "assert" as const,
        evidence_before: "placeholder.png",
        evidence_after: "placeholder.png",
      },
    ],
  };
}

function loadManifest(manifestPath: string): ManifestEntry[] {
  if (!existsSync(manifestPath)) return [];
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8")) as ManifestEntry[];
  } catch {
    return [];
  }
}

/**
 * Promote a passing HarnessRun to a persistent artifact bundle.
 * Returns { written: false } if verdict !== "pass" or evidence is incomplete.
 */
export function promoteArtifact(run: HarnessRun, options: PromoteOptions): PromoteResult {
  if (run.verdict !== "pass") {
    return { written: false, reason: `verdict is ${run.verdict}, not pass` };
  }

  if (!hasCompleteEvidence(run)) {
    return { written: false, reason: "incomplete evidence: one or more steps have null screenshotPath" };
  }

  const featureSlug = options.featureSlug ?? run.nodeId ?? run.id;
  const artifactDir = join(options.artifactsDir, run.id);
  const evidencesDir = join(artifactDir, "evidences");

  mkdirSync(artifactDir, { recursive: true });
  mkdirSync(evidencesDir, { recursive: true });

  const recipe = buildRecipe(run);
  const recipePath = join(artifactDir, "recipe.json");
  writeFileSync(recipePath, JSON.stringify(recipe, null, 2) + "\n", "utf-8");

  const spec = generatePlaywrightSpec(recipe, featureSlug);
  const specPath = join(artifactDir, "spec.ts");
  writeFileSync(specPath, spec, "utf-8");

  const manifestPath = join(options.artifactsDir, "manifest.json");
  const manifest = loadManifest(manifestPath);
  manifest.push({
    runId: run.id,
    nodeId: run.nodeId,
    featureSlug,
    promotedAt: Date.now(),
    specPath,
  });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  return { written: true, specPath, recipePath, artifactDir };
}
