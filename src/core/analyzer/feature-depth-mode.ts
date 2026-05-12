/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * feature-depth-mode — pure parser bridging the Go feature-depth tool
 * to the TypeScript `analyze` umbrella.
 *
 * The Go binary emits JSON of shape
 *   { tool, mode, totalFiles, avgScore, files: FileEntry[] }
 *
 * This module turns that into a stable `FeatureDepthResult` consumable
 * by analyze() — adding grade derivation (A/B/C/D/F per project rubric)
 * and a worst-N convenience slice for agents that want a focused
 * remediation list without pulling all 800+ files into context.
 */

import { readdir } from "node:fs/promises";
import { InvalidArgumentError } from "../utils/errors.js";

const SOURCE_EXTENSIONS = new Set([".go", ".ts", ".tsx", ".js", ".jsx"]);

/** Returns true if `dir` contains at least one source file (Go or TS/JS). */
export async function hasSourceFiles(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true });
    return entries.some((e) => {
      if (!e.isFile()) return false;
      const name = String(e.name);
      const dot = name.lastIndexOf(".");
      return dot !== -1 && SOURCE_EXTENSIONS.has(name.slice(dot));
    });
  } catch {
    return false;
  }
}

export type FeatureDepthGrade = "A" | "B" | "C" | "D" | "F";

export interface FeatureDepthFile {
  relPath: string;
  module: string;
  score: number;
  grade: FeatureDepthGrade;
  hasTest: boolean;
  loc: number;
  testLoc: number;
}

export interface FeatureDepthGradeDistribution {
  A: number;
  B: number;
  C: number;
  D: number;
  F: number;
}

export interface FeatureDepthResult {
  totalFiles: number;
  avgScore: number;
  gradeDistribution: FeatureDepthGradeDistribution;
  worstFiles: FeatureDepthFile[];
}

export interface ParseOptions {
  /** How many worst-graded files to surface in `worstFiles`. Default 10. */
  worstN?: number;
}

const DEFAULT_WORST_N = 10;

interface RawFileEntry {
  RelPath?: unknown;
  Module?: unknown;
  Score?: unknown;
  HasTest?: unknown;
  LOC?: unknown;
  TestLOC?: unknown;
}

interface RawAudit {
  totalFiles?: unknown;
  avgScore?: unknown;
  files?: unknown;
}

/**
 * Parse the Go tool's JSON output. Throws InvalidArgumentError when the
 * input cannot be parsed or is missing the `files` array.
 */
export function parseFeatureDepthAudit(json: string, options?: ParseOptions): FeatureDepthResult {
  const worstN = options?.worstN ?? DEFAULT_WORST_N;

  let raw: RawAudit;
  try {
    raw = JSON.parse(json) as RawAudit;
  } catch {
    throw new InvalidArgumentError("feature_depth: input is not valid JSON");
  }

  if (!Array.isArray(raw.files)) {
    throw new InvalidArgumentError("feature_depth: JSON missing required `files` array");
  }

  const files: FeatureDepthFile[] = (raw.files as RawFileEntry[]).map((entry) => {
    const score = typeof entry.Score === "number" ? entry.Score : 0;
    return {
      relPath: typeof entry.RelPath === "string" ? entry.RelPath : "",
      module: typeof entry.Module === "string" ? entry.Module : "",
      score,
      grade: scoreToGrade(score),
      hasTest: entry.HasTest === true,
      loc: typeof entry.LOC === "number" ? entry.LOC : 0,
      testLoc: typeof entry.TestLOC === "number" ? entry.TestLOC : 0,
    };
  });

  const distribution: FeatureDepthGradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const file of files) distribution[file.grade] += 1;

  const sortedAscending = [...files].sort((a, b) => a.score - b.score);
  const worstFiles = sortedAscending.slice(0, worstN);

  return {
    totalFiles: typeof raw.totalFiles === "number" ? raw.totalFiles : files.length,
    avgScore: typeof raw.avgScore === "number" ? raw.avgScore : 0,
    gradeDistribution: distribution,
    worstFiles,
  };
}

/**
 * Project rubric (per `tools/feature-depth` README):
 *   A ≥ 80 · B ≥ 65 · C ≥ 50 · D ≥ 35 · F otherwise.
 */
export function scoreToGrade(score: number): FeatureDepthGrade {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}
