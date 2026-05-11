/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 2.2: feature manifest index.
 *
 * Maps featureNodeId → { paths, status } so `query_graph(feature)` can
 * resolve artifact paths. Cleanup marks deleted features as orphan without
 * deleting their files (preserved for review).
 *
 * All transform functions are pure — callers handle JSON load/save.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface FeatureManifestEntry {
  paths: string[];
  status: "active" | "orphan";
}

export type FeatureManifest = Record<string, FeatureManifestEntry>;

/** Insert or replace paths for a feature. Returns a new manifest (immutable). */
export function upsertFeatureEntry(
  manifest: FeatureManifest,
  featureNodeId: string,
  artifactPaths: string[],
): FeatureManifest {
  return { ...manifest, [featureNodeId]: { paths: artifactPaths, status: "active" } };
}

/** Return paths for a feature, or null if not found. */
export function queryFeatureEntry(
  manifest: FeatureManifest,
  featureNodeId: string,
): string[] | null {
  const entry = manifest[featureNodeId];
  return entry ? entry.paths : null;
}

/**
 * Mark entries absent from activeFeatureIds as orphan.
 * Preserves paths — files are never deleted.
 * Returns a new manifest (immutable).
 */
export function markOrphanedEntries(
  manifest: FeatureManifest,
  activeFeatureIds: string[],
): FeatureManifest {
  const activeSet = new Set(activeFeatureIds);
  const result: FeatureManifest = {};
  for (const [id, entry] of Object.entries(manifest)) {
    result[id] = { ...entry, status: activeSet.has(id) ? "active" : "orphan" };
  }
  return result;
}

/** Load manifest from disk, returning empty object if file absent or invalid. */
export function loadFeatureManifest(manifestPath: string): FeatureManifest {
  if (!existsSync(manifestPath)) return {};
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8")) as FeatureManifest;
  } catch {
    return {};
  }
}

/** Persist manifest to disk as formatted JSON. */
export function saveFeatureManifest(manifestPath: string, manifest: FeatureManifest): void {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}
