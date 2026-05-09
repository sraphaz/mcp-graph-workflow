/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.3 — Promoção passed → artifact
 *
 * AC1: GIVEN run passed + all screenshots WHEN promoveArtifact THEN spec.ts + recipe.json + evidences/ written
 * AC2: GIVEN feature inexistente WHEN promove THEN cria diretório + entry no manifest
 * AC3: GIVEN evidência incompleta WHEN promove THEN retorna { written: false } e não escreve nada
 */

import { describe, it, expect } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promoteArtifact } from "../core/browser-harness/artifact-promoter.js";
import type { HarnessRun } from "../schemas/browser-harness.schema.js";

function makeRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    id: "bhrun-test-001",
    sessionId: "sess-001",
    nodeId: "node-feature-001",
    prompt: "login flow",
    plan: [{ index: 0, helper: "navigate", args: { url: "https://example.com" } }],
    results: [
      {
        index: 0,
        helper: "navigate",
        ok: true,
        durationMs: 100,
        screenshotPath: "/tmp/screenshots/0.png",
        error: null,
      },
    ],
    verdict: "pass",
    durationMs: 200,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1: spec.ts + recipe.json + evidences/ written
// ---------------------------------------------------------------------------

describe("promoteArtifact — AC1: artifacts written on pass", () => {
  it("returns written: true for a passing run with complete evidence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const result = await promoteArtifact(makeRun(), { artifactsDir: dir });
      expect(result.written).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("creates spec.ts in the artifact directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const result = await promoteArtifact(makeRun(), { artifactsDir: dir });
      expect(result.specPath).toBeDefined();
      expect(existsSync(result.specPath!)).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("creates recipe.json in the artifact directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const result = await promoteArtifact(makeRun(), { artifactsDir: dir });
      expect(result.recipePath).toBeDefined();
      expect(existsSync(result.recipePath!)).toBe(true);
      const raw = await readFile(result.recipePath!, "utf-8");
      const recipe = JSON.parse(raw) as Record<string, unknown>;
      expect(recipe["runId"]).toBe("bhrun-test-001");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("spec.ts contains @playwright/test import and run id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const result = await promoteArtifact(makeRun(), { artifactsDir: dir });
      const spec = await readFile(result.specPath!, "utf-8");
      expect(spec).toContain("@playwright/test");
      expect(spec).toContain("bhrun-test-001");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC2: creates directory + manifest entry for new feature
// ---------------------------------------------------------------------------

describe("promoteArtifact — AC2: creates dir + manifest entry", () => {
  it("creates the feature artifact directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const run = makeRun({ nodeId: "node-my-feature" });
      const result = await promoteArtifact(run, { artifactsDir: dir });
      expect(result.artifactDir).toBeDefined();
      expect(existsSync(result.artifactDir!)).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("writes an entry to manifest.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const run = makeRun({ nodeId: "node-manifest-test" });
      await promoteArtifact(run, { artifactsDir: dir });
      const manifestPath = join(dir, "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);
      const raw = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(raw) as Array<Record<string, unknown>>;
      expect(Array.isArray(manifest)).toBe(true);
      expect(manifest.some((e) => e["runId"] === "bhrun-test-001")).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC3: incomplete evidence → nothing written
// ---------------------------------------------------------------------------

describe("promoteArtifact — AC3: gate on incomplete evidence", () => {
  it("returns written: false when a step has null screenshotPath", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const run = makeRun({
        results: [
          {
            index: 0,
            helper: "navigate",
            ok: true,
            durationMs: 50,
            screenshotPath: null, // missing evidence
            error: null,
          },
        ],
      });
      const result = await promoteArtifact(run, { artifactsDir: dir });
      expect(result.written).toBe(false);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("writes nothing to disk when evidence is incomplete", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const run = makeRun({
        results: [
          {
            index: 0,
            helper: "navigate",
            ok: true,
            durationMs: 50,
            screenshotPath: null,
            error: null,
          },
        ],
      });
      await promoteArtifact(run, { artifactsDir: dir });
      const featureDir = join(dir, run.id);
      expect(existsSync(featureDir)).toBe(false);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns written: false for failed verdict", async () => {
    const dir = await mkdtemp(join(tmpdir(), "art-test-"));
    try {
      const run = makeRun({ verdict: "fail" });
      const result = await promoteArtifact(run, { artifactsDir: dir });
      expect(result.written).toBe(false);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
