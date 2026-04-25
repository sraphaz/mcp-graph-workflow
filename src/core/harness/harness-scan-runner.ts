/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import type Database from "better-sqlite3";
import { globSync } from "glob";
import { scanTypeCoverage } from "./type-coverage-scanner.js";
import { scanTestCoverage } from "./test-coverage-scanner.js";
import { scanDocsCoverage } from "./docs-coverage-scanner.js";
import { scanNamingClarity } from "./naming-clarity-scanner.js";
import { scanErrorHandling } from "./error-handling-scanner.js";
import { scanContextDensity } from "./context-density-scanner.js";
import { scanProvenance } from "./provenance-scanner.js";
import { computeHarnessabilityScore, type HarnessabilityResult } from "./harnessability-score.js";
import {
  checkDependencyDirection,
  checkCircularDependencies,
  checkBarrelIntegrity,
} from "./fitness-functions.js";
import { IssuePatternTracker, type RuleSuggestion } from "./issue-pattern-tracker.js";
import type { ViolationDetail } from "./violation-detail.js";

export interface HarnessScanResult extends HarnessabilityResult {
  details: string[];
  timestamp: string;
  ruleSuggestions: RuleSuggestion[];
  regression?: true;
  regressionDelta?: number;
  /** File-level violations — only present when options.collectViolations=true */
  violations?: ViolationDetail[];
}

export interface HarnessScanOptions {
  /** When true, collect file-level violations from all scanners. Default: false */
  collectViolations?: boolean;
  /** Maximum violations to return (default: 500) */
  maxViolations?: number;
}

/** Run a full 7-dimension harnessability scan on the project. */
export function runHarnessScan(rootDir: string, db?: Database.Database, eventBus?: import("../events/event-bus.js").GraphEventBus, options?: HarnessScanOptions): HarnessScanResult {
  // 1. Type Coverage — exclude node_modules (e.g. src/web/dashboard/node_modules)
  const tsFiles = globSync("src/**/*.ts", {
    cwd: rootDir,
    ignore: ["src/**/*.test.ts", "src/**/*.bench.ts", "src/types/**", "**/node_modules/**"],
  });
  const typeFiles = tsFiles.map((p) => ({
    path: p,
    content: fs.readFileSync(path.join(rootDir, p), "utf-8"),
  }));
  const collect = options?.collectViolations === true;
  const scannerOpts = collect ? { collectViolations: true } : undefined;

  const typeResult = scanTypeCoverage(typeFiles, scannerOpts);

  // 2. Test Coverage — exclude node_modules to avoid counting third-party TS files
  const modules = globSync("src/**/*.ts", {
    cwd: rootDir,
    ignore: ["src/**/*.test.ts", "src/**/*.bench.ts", "src/index.ts", "**/node_modules/**"],
  }).map((p) => path.basename(p, ".ts"));
  const testFiles = globSync("src/tests/**/*.test.ts", { cwd: rootDir }).map((p) => ({
    name: path.basename(p),
    hasAssertions: fs.readFileSync(path.join(rootDir, p), "utf-8").includes("expect("),
  }));
  const testResult = scanTestCoverage(modules, testFiles, scannerOpts);

  // 3. Docs Coverage
  const docsInput = {
    hasClaudeMd: fs.existsSync(path.join(rootDir, "CLAUDE.md")),
    hasReadme: fs.existsSync(path.join(rootDir, "README.md")),
    rulesCount: globSync(".claude/rules/*.md", { cwd: rootDir }).length,
    srcDirsCount: fs
      .readdirSync(path.join(rootDir, "src"), { withFileTypes: true })
      .filter((d) => d.isDirectory()).length,
    hasDocsDir: fs.existsSync(path.join(rootDir, "docs")),
  };
  const docsResult = scanDocsCoverage(docsInput);

  // 4. Architecture Fitness — exclude node_modules
  const allSrcFiles = globSync("src/**/*.ts", { cwd: rootDir, ignore: ["**/node_modules/**"] }).map((p) => ({
    path: p,
    content: fs.readFileSync(path.join(rootDir, p), "utf-8"),
  }));
  const fitnessResults = [
    checkDependencyDirection(allSrcFiles),
    checkCircularDependencies(allSrcFiles),
    checkBarrelIntegrity(
      fs
        .readdirSync(path.join(rootDir, "src"), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => ({
          path: `src/${d.name}`,
          files: fs.readdirSync(path.join(rootDir, "src", d.name)),
          indexContent: fs.existsSync(path.join(rootDir, "src", d.name, "index.ts"))
            ? fs.readFileSync(path.join(rootDir, "src", d.name, "index.ts"), "utf-8")
            : null,
        })),
    ),
  ];
  const passedFitness = fitnessResults.filter((r) => r.passed).length;
  const fitnessScore = Math.round((passedFitness / fitnessResults.length) * 100);

  // 5. Naming Clarity
  const namingResult = scanNamingClarity(typeFiles, scannerOpts);

  // 6. Error Handling
  const errorResult = scanErrorHandling(typeFiles, scannerOpts);

  // 7. Context Density
  const contextResult = scanContextDensity(typeFiles, scannerOpts);

  // 8. Provenance Coverage (requires DB)
  const provenanceResult = db ? scanProvenance(db) : null;

  // 9. Final Score (8 dimensions)
  const finalResult = computeHarnessabilityScore({
    typeScore: typeResult.typeScore,
    testScore: testResult.testScore,
    docsScore: docsResult.docsScore,
    fitnessScore,
    namingScore: namingResult.namingScore,
    errorHandlingScore: errorResult.errorHandlingScore,
    contextDensityScore: contextResult.contextDensityScore,
    provenanceScore: provenanceResult?.provenanceScore,
  });

  // 10. Build details summary
  const details: string[] = [
    `Type Coverage: ${typeResult.typeScore}% (${typeResult.totalFiles} files, ${typeResult.filesWithAny} with 'any')`,
    `Test Coverage: ${testResult.testScore}% (${testResult.totalModules} modules, ${testResult.testedModules} tested)`,
    `Docs Coverage: ${docsResult.docsScore}% (CLAUDE.md: ${docsInput.hasClaudeMd}, rules: ${docsInput.rulesCount})`,
    `Architecture Fitness: ${fitnessScore}% (${passedFitness}/${fitnessResults.length} checks passed)`,
    `Naming Clarity: ${namingResult.namingScore}% (${namingResult.flaggedSymbols} violations in ${namingResult.totalSymbols} names)`,
    `Error Handling: ${errorResult.errorHandlingScore}% (${errorResult.rawThrows} raw throws, ${errorResult.swallowedCatches} swallowed catches)`,
    `Context Density: ${contextResult.contextDensityScore}% (${contextResult.documentedExports}/${contextResult.totalExports} exports documented)`,
    provenanceResult
      ? `Provenance Coverage: ${provenanceResult.provenanceScore}% (${provenanceResult.nodesWithReceipt}/${provenanceResult.totalNodes} nodes with receipt)`
      : `Provenance Coverage: n/a (no DB)`,
  ];

  // Add fitness failure details
  for (const r of fitnessResults) {
    if (!r.passed) {
      details.push(
        `Fitness fail [${r.name}]: ${r.violations.slice(0, 3).map((v) => `${v.file}:${v.line} -> ${v.rule}`).join("; ")}`,
      );
    }
  }

  // 11. Merge violations from all scanners (v4)
  let mergedViolations: ViolationDetail[] | undefined;
  if (collect) {
    const maxViolations = options?.maxViolations ?? 500;
    const all: ViolationDetail[] = [];

    // Scanners that return ViolationDetail[] directly
    if (typeResult.violations) all.push(...typeResult.violations);
    if (testResult.violations) all.push(...testResult.violations);
    if (namingResult.violations) all.push(...namingResult.violations);
    if (errorResult.violations) all.push(...errorResult.violations);
    if (contextResult.violations) all.push(...contextResult.violations);

    // Convert fitness Violation[] → ViolationDetail[]
    for (const fr of fitnessResults) {
      if (!fr.passed) {
        for (const v of fr.violations) {
          all.push({
            file: v.file,
            line: v.line,
            dimension: 'fitness',
            violationType: fr.name === 'dependency_direction' ? 'bad_import'
              : fr.name === 'circular_dependencies' ? 'circular_dep'
              : 'missing_barrel',
            evidence: v.rule,
            confidence: 1.0,
          });
        }
      }
    }

    mergedViolations = all.slice(0, maxViolations);
  }

  // 12. Rule suggestions from steering loop
  const ruleSuggestions: RuleSuggestion[] = db
    ? new IssuePatternTracker(db).getSuggestedRules()
    : [];

  const timestamp = new Date().toISOString();
  const result: HarnessScanResult = {
    ...finalResult,
    details,
    timestamp,
    ruleSuggestions,
    ...(mergedViolations !== undefined ? { violations: mergedViolations } : {}),
  };

  if (db) {
    const projectId = "proj_local";
    const lastRow = db
      .prepare(
        "SELECT score FROM harness_history WHERE project_id = ? ORDER BY timestamp DESC LIMIT 1",
      )
      .get(projectId) as { score: number } | undefined;

    if (lastRow !== undefined && finalResult.score <= lastRow.score - 5) {
      result.regression = true;
      result.regressionDelta = +(finalResult.score - lastRow.score).toFixed(2);
    }

    let gitCommit: string | null = null;
    try {
      gitCommit = execSync("git rev-parse HEAD", { cwd: process.cwd(), stdio: "pipe" })
        .toString()
        .trim();
    } catch {
      // not a git repo or git unavailable
    }

    db.prepare(
      `INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      projectId,
      finalResult.score,
      finalResult.grade,
      JSON.stringify(finalResult.breakdown),
      gitCommit,
      timestamp,
    );
  }

  // Emit harness events (non-blocking, only if eventBus provided)
  if (eventBus) {
    try {
      eventBus.emit({
        type: "harness:scan_completed",
        timestamp,
        payload: { score: finalResult.score, grade: finalResult.grade, timestamp },
      });
      if (result.regression && result.regressionDelta !== undefined) {
        const before = +(finalResult.score - result.regressionDelta).toFixed(1);
        eventBus.emit({
          type: "harness:regression_detected",
          timestamp,
          payload: { before, after: finalResult.score, delta: result.regressionDelta },
        });
      }
    } catch {
      // EventBus handler crashed — non-blocking
    }
  }

  return result;
}
