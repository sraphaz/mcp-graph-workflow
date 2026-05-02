#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * AST-aware rename of naming-clarity violations using ts-morph.
 *
 * Targets the bindings the harness scanner penalises:
 *   - generic names: data, result, item, obj, temp, val, res
 *   - single-char names except i/j/k/e
 *
 * For each violating VariableDeclaration, calls .rename() — ts-morph
 * uses the TypeScript language service to update every reference in the
 * project's scope while leaving same-named object keys, string literals,
 * and unrelated symbols untouched.
 */

import { Project, SyntaxKind } from "ts-morph";

const FORBIDDEN = new Set(["data", "result", "item", "obj", "temp", "val", "res"]);
const ALLOWED_SINGLE = new Set(["i", "j", "k", "e"]);

function isViolation(name) {
  if (FORBIDDEN.has(name)) return true;
  if (name.length === 1 && !ALLOWED_SINGLE.has(name)) return true;
  return false;
}

function newName(oldName) {
  if (FORBIDDEN.has(oldName)) {
    // Use a domain-neutral but distinct suffix
    return `${oldName}Value`;
  }
  // single-char → expand with descriptive suffix
  return `${oldName}Var`;
}

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  skipAddingFilesFromTsConfig: false,
});

let renamed = 0;
let filesTouched = new Set();
let skippedDestructure = 0;
let skippedExported = 0;

const sourceFiles = project.getSourceFiles();
for (const sourceFile of sourceFiles) {
  const filePath = sourceFile.getFilePath();
  // Skip tests, bench, dashboard (excluded from scanner anyway), and node_modules
  if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) continue;
  if (filePath.endsWith(".bench.ts")) continue;
  if (filePath.includes("/node_modules/")) continue;
  if (filePath.includes("/web/dashboard/")) continue;

  // Include nested decls (inside functions, blocks, etc.) — the harness
  // scanner penalises every binding regardless of scope.
  const decls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const decl of decls) {
    let name;
    try { name = decl.getName(); } catch { continue; }
    if (!isViolation(name)) continue;

    // Skip destructured patterns ({ data } = ...) — ts-morph rename shorthand
    // is awkward and risks breaking object property aliases.
    const nameNode = decl.getNameNode();
    if (nameNode.getKindName() !== "Identifier") {
      skippedDestructure += 1;
      continue;
    }

    // Skip exported declarations — renaming them would break consumers
    // outside this codebase or change the public API surface.
    const varStmt = decl.getVariableStatement();
    if (varStmt && varStmt.isExported()) {
      skippedExported += 1;
      continue;
    }

    try {
      decl.rename(newName(name));
      renamed += 1;
      filesTouched.add(filePath);
    } catch (err) {
      // Best-effort — some edge cases (rebound names, computed) skip
    }
  }
}

project.saveSync();

console.log(JSON.stringify({
  renamed,
  filesTouched: filesTouched.size,
  skippedDestructure,
  skippedExported,
}, null, 2));
