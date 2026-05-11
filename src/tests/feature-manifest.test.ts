/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 2.2: feature manifest index
 *
 * AC1: GIVEN manifest atualizado WHEN queryFeatureEntry roda THEN retorna paths
 * AC2: GIVEN feature deletada WHEN markOrphanedEntries THEN entry vira orphan (arquivo preservado)
 */

import { describe, it, expect } from "vitest";
import {
  upsertFeatureEntry,
  queryFeatureEntry,
  markOrphanedEntries,
  type FeatureManifest,
} from "../core/browser-harness/feature-manifest.js";

// ── AC1: upsert + query ────────────────────────────────────────────────────

describe("feature-manifest — AC1: upsert and query", () => {
  it("AC1: queryFeatureEntry returns paths after upsert", () => {
    const manifest: FeatureManifest = {};
    const updated = upsertFeatureEntry(manifest, "node_abc", ["/specs/abc/spec.ts"]);
    const paths = queryFeatureEntry(updated, "node_abc");
    expect(paths).toEqual(["/specs/abc/spec.ts"]);
  });

  it("AC1: upsert replaces paths for existing feature", () => {
    let manifest: FeatureManifest = {};
    manifest = upsertFeatureEntry(manifest, "node_abc", ["/old/spec.ts"]);
    manifest = upsertFeatureEntry(manifest, "node_abc", ["/new/spec.ts", "/new/recipe.json"]);
    expect(queryFeatureEntry(manifest, "node_abc")).toEqual(["/new/spec.ts", "/new/recipe.json"]);
  });

  it("AC1: queryFeatureEntry returns null for unknown feature", () => {
    const manifest: FeatureManifest = {};
    expect(queryFeatureEntry(manifest, "node_unknown")).toBeNull();
  });

  it("AC1: upsert is immutable — original manifest unchanged", () => {
    const original: FeatureManifest = {};
    upsertFeatureEntry(original, "node_abc", ["/spec.ts"]);
    expect(original["node_abc"]).toBeUndefined();
  });

  it("AC1: multiple features coexist in manifest", () => {
    let manifest: FeatureManifest = {};
    manifest = upsertFeatureEntry(manifest, "node_a", ["/a.ts"]);
    manifest = upsertFeatureEntry(manifest, "node_b", ["/b.ts"]);
    expect(queryFeatureEntry(manifest, "node_a")).toEqual(["/a.ts"]);
    expect(queryFeatureEntry(manifest, "node_b")).toEqual(["/b.ts"]);
  });
});

// ── AC2: orphan cleanup ────────────────────────────────────────────────────

describe("feature-manifest — AC2: orphan marking", () => {
  it("AC2: feature absent from activeIds becomes orphan status", () => {
    let manifest: FeatureManifest = {};
    manifest = upsertFeatureEntry(manifest, "node_deleted", ["/spec.ts"]);
    const cleaned = markOrphanedEntries(manifest, []);
    expect(cleaned["node_deleted"]?.status).toBe("orphan");
  });

  it("AC2: orphaned entry preserves its paths (file not deleted)", () => {
    let manifest: FeatureManifest = {};
    manifest = upsertFeatureEntry(manifest, "node_deleted", ["/spec.ts", "/recipe.json"]);
    const cleaned = markOrphanedEntries(manifest, []);
    expect(cleaned["node_deleted"]?.paths).toEqual(["/spec.ts", "/recipe.json"]);
  });

  it("AC2: active feature keeps status active after cleanup", () => {
    let manifest: FeatureManifest = {};
    manifest = upsertFeatureEntry(manifest, "node_active", ["/spec.ts"]);
    const cleaned = markOrphanedEntries(manifest, ["node_active"]);
    expect(cleaned["node_active"]?.status).toBe("active");
  });

  it("AC2: mixed active+deleted — only deleted becomes orphan", () => {
    let manifest: FeatureManifest = {};
    manifest = upsertFeatureEntry(manifest, "node_keep", ["/a.ts"]);
    manifest = upsertFeatureEntry(manifest, "node_gone", ["/b.ts"]);
    const cleaned = markOrphanedEntries(manifest, ["node_keep"]);
    expect(cleaned["node_keep"]?.status).toBe("active");
    expect(cleaned["node_gone"]?.status).toBe("orphan");
  });

  it("AC2: markOrphanedEntries is immutable — original unchanged", () => {
    let manifest: FeatureManifest = {};
    manifest = upsertFeatureEntry(manifest, "node_x", ["/x.ts"]);
    markOrphanedEntries(manifest, []);
    expect(manifest["node_x"]?.status).toBe("active");
  });
});
