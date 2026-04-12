/**
 * Architecture Fitness Functions — Harness Engineering
 *
 * Automated checks for architectural health:
 * - Dependency Direction: core/ must not import from cli/, mcp/, api/, web/
 * - Circular Dependencies: detect import cycles between modules
 * - Barrel Export Integrity: index.ts re-exports all sibling modules
 *
 * Based on: "Harness Engineering for Coding Agent Users" (Böckeler, Thoughtworks 2026)
 */

import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface Violation {
  file: string;
  line: number;
  importPath: string;
  rule: string;
}

export interface FitnessCheckResult {
  name: string;
  passed: boolean;
  violations: Violation[];
  checkedFiles: number;
}

export interface FileContent {
  path: string;
  content: string;
}

// ── Dependency Direction Rules ──────────────────────────

/**
 * Rules: which modules CANNOT import from which other modules.
 * Key = source module prefix, Value = forbidden import targets.
 */
const DEPENDENCY_RULES: Array<{ source: string; forbidden: string[]; rule: string }> = [
  {
    source: "src/core/",
    forbidden: ["cli/", "mcp/", "api/", "web/"],
    rule: "core/ must not import from cli/, mcp/, api/, or web/",
  },
  {
    source: "src/schemas/",
    forbidden: ["core/", "mcp/", "cli/", "api/", "web/"],
    rule: "schemas/ must not import from core/, mcp/, cli/, api/, or web/",
  },
];

/**
 * Check that module dependency direction is correct.
 * core/ should not depend on cli/, mcp/, api/, web/.
 * schemas/ should not depend on core/, mcp/, cli/.
 */
export function checkDependencyDirection(files: FileContent[]): FitnessCheckResult {
  const violations: Violation[] = [];
  const importPattern = /from\s+["']([^"']+)["']/g;

  for (const file of files) {
    // Find applicable rules for this file's path
    for (const rule of DEPENDENCY_RULES) {
      if (!file.path.includes(rule.source)) continue;

      // Scan all imports
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match: RegExpExecArray | null;
        importPattern.lastIndex = 0;

        while ((match = importPattern.exec(line)) !== null) {
          const importPath = match[1];
          // Resolve relative imports to check against forbidden targets
          for (const forbidden of rule.forbidden) {
            if (importPath.includes(forbidden) || importPath.includes(`../${forbidden}`)) {
              violations.push({
                file: file.path,
                line: i + 1,
                importPath,
                rule: rule.rule,
              });
            }
          }
        }
      }
    }
  }

  logger.debug(`Fitness: dependency_direction checked=${files.length} violations=${violations.length}`);

  return {
    name: "dependency_direction",
    passed: violations.length === 0,
    violations,
    checkedFiles: files.length,
  };
}

/**
 * Check for circular dependencies between modules.
 * Builds an import graph and detects cycles via DFS.
 */
export function checkCircularDependencies(files: FileContent[]): FitnessCheckResult {
  // Build adjacency list: file -> [imported files]
  const graph = new Map<string, Set<string>>();
  const importPattern = /from\s+["'](\.\.?\/[^"']+)["']/g;

  for (const file of files) {
    const deps = new Set<string>();
    let match: RegExpExecArray | null;
    importPattern.lastIndex = 0;

    const content = file.content;
    while ((match = importPattern.exec(content)) !== null) {
      deps.add(match[1]);
    }

    // Extract module name (first 2 path segments under src/)
    const parts = file.path.split("/");
    const srcIdx = parts.indexOf("src");
    if (srcIdx >= 0 && parts.length > srcIdx + 2) {
      const module = parts[srcIdx + 1] + "/" + parts[srcIdx + 2];
      if (!graph.has(module)) graph.set(module, new Set());
      for (const dep of deps) {
        // Resolve relative dep to module
        const depParts = dep.split("/");
        for (const forbidden of depParts) {
          if (forbidden === ".." || forbidden === ".") continue;
          const depModule = depParts.length >= 2 ? depParts.slice(-2).join("/").replace(/\.js$/, "") : forbidden;
          const moduleSet = graph.get(module);
          if (moduleSet) moduleSet.add(depModule);
          break;
        }
      }
    }
  }

  // DFS cycle detection
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node, []);
  }

  const violations: Violation[] = cycles.map((cycle) => ({
    file: cycle.join(" -> "),
    line: 0,
    importPath: cycle.join(" -> "),
    rule: "No circular dependencies between modules",
  }));

  logger.debug(`Fitness: circular_deps modules=${graph.size} cycles=${cycles.length}`);

  return {
    name: "circular_deps",
    passed: cycles.length === 0,
    violations,
    checkedFiles: files.length,
  };
}

// ── Barrel Export Integrity ──────────────────────────────

export interface DirectoryInfo {
  path: string;
  files: string[];
  indexContent: string | null;
}

/**
 * Check that barrel files (index.ts) re-export all sibling modules.
 */
export function checkBarrelIntegrity(dirs: DirectoryInfo[]): FitnessCheckResult {
  const violations: Violation[] = [];
  let checkedDirs = 0;

  for (const dir of dirs) {
    if (dir.indexContent === null) {
      // No barrel file — not a violation, just not covered
      checkedDirs++;
      continue;
    }

    checkedDirs++;
    const siblingModules = dir.files
      .filter((f) => f.endsWith(".ts") && f !== "index.ts" && !f.endsWith(".test.ts") && !f.endsWith(".bench.ts"))
      .map((f) => f.replace(/\.ts$/, ""));

    for (const mod of siblingModules) {
      // Check if index.ts references this module (via re-export or import)
      if (!dir.indexContent.includes(`./${mod}`) && !dir.indexContent.includes(`"./${mod}.js"`)) {
        violations.push({
          file: `${dir.path}/index.ts`,
          line: 0,
          importPath: `./${mod}`,
          rule: `Barrel file missing re-export for "${mod}"`,
        });
      }
    }
  }

  logger.debug(`Fitness: barrel_integrity dirs=${checkedDirs} violations=${violations.length}`);

  return {
    name: "barrel_integrity",
    passed: violations.length === 0,
    violations,
    checkedFiles: checkedDirs,
  };
}
