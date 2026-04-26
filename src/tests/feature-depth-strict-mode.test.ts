/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Phase E — strict mode promotion. Verifies the feature_depth_mode
 * setting drives runFeatureDepthCheck's blocker / warning split.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { upsertBaseline } from "../core/feature-depth/baselines-store.js";
import { runFeatureDepthCheck } from "../core/feature-depth/finish-task-integration.js";

function makeProject(): { root: string; relPath: string } {
  const root = mkdtempSync(join(tmpdir(), "fd-strict-"));
  const dir = join(root, "src", "core", "x");
  mkdirSync(dir, { recursive: true });
  // Bare file with no tests, no error handling, no validation — guaranteed
  // to score low (will trigger regression vs a high baseline).
  writeFileSync(
    join(dir, "foo.ts"),
    "export function f(x: any): any { return x; }\n",
    "utf-8",
  );
  return { root, relPath: "src/core/x/foo.ts" };
}

function seedHighBaseline(store: SqliteStore, relPath: string): void {
  // Seed an artificially high prior so the regression gate fires.
  upsertBaseline(store.getDb(), {
    relPath,
    module: "x",
    score: 90,
    quadrant: "MATURE",
    testLoc: 200,
    sourceLoc: 50,
  });
}

describe("runFeatureDepthCheck — strict mode", () => {
  let store: SqliteStore;
  let projectRoot: string;
  let relPath: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("strict-test");
    const project = makeProject();
    projectRoot = project.root;
    relPath = project.relPath;
    seedHighBaseline(store, relPath);
  });

  it("default (no setting) is advisory — warnings populated, blockers empty", async () => {
    const r = await runFeatureDepthCheck({
      store,
      projectRoot,
      nodeId: "n1",
      touchedFiles: [relPath],
    });
    expect(r.mode).toBe("advisory");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.blockers).toEqual([]);
  });

  it("explicit advisory matches default", async () => {
    store.setProjectSetting("feature_depth_mode", "advisory");
    const r = await runFeatureDepthCheck({
      store, projectRoot, nodeId: "n1", touchedFiles: [relPath],
    });
    expect(r.mode).toBe("advisory");
    expect(r.blockers).toEqual([]);
  });

  it("strict promotes regressions into blockers", async () => {
    store.setProjectSetting("feature_depth_mode", "strict");
    const r = await runFeatureDepthCheck({
      store, projectRoot, nodeId: "n1", touchedFiles: [relPath],
    });
    expect(r.mode).toBe("strict");
    expect(r.blockers.length).toBeGreaterThan(0);
    expect(r.blockers).toEqual(r.warnings);
  });

  it("strict mode without regression still passes (no blockers when score holds)", async () => {
    // Reset baseline to current score so there's no delta.
    const initial = await runFeatureDepthCheck({
      store, projectRoot, nodeId: "n1", touchedFiles: [relPath],
    });
    const current = initial.files[0]?.after ?? 0;
    upsertBaseline(store.getDb(), {
      relPath, module: "x", score: current,
      quadrant: "INCIPIENT", testLoc: 0, sourceLoc: 50,
    });

    store.setProjectSetting("feature_depth_mode", "strict");
    const r = await runFeatureDepthCheck({
      store, projectRoot, nodeId: "n1", touchedFiles: [relPath],
    });
    expect(r.mode).toBe("strict");
    expect(r.warnings).toEqual([]);
    expect(r.blockers).toEqual([]);
  });

  it("off mode short-circuits — no files analyzed at all", async () => {
    store.setProjectSetting("feature_depth_mode", "off");
    const r = await runFeatureDepthCheck({
      store, projectRoot, nodeId: "n1", touchedFiles: [relPath],
    });
    expect(r.mode).toBe("off");
    expect(r.files).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.blockers).toEqual([]);
  });
});
