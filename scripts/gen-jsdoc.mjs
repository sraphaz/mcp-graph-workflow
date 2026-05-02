#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Bulk-add minimal JSDoc above undocumented public exports detected by
 * the context-density scanner. Adds a single-line JSDoc block when the
 * preceding non-blank line does not already end with `*\/`.
 *
 * Smoke-grade documentation. Replace with proper JSDoc when touching the
 * function — see CLAUDE.md "Testing & Quality Methodology".
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();
const SRC = join(REPO, "src");

// Mirrors the scanner regex (context-density-scanner.ts).
const IS_EXPORT_FN_LINE =
  /^[ \t]*export\s+(?:async\s+)?function\s+[A-Za-z_$]|^[ \t]*export\s+const\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*(?:async\s*)?\(/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      if (full.includes("/web/dashboard")) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (!entry.name.endsWith(".ts")) continue;
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".bench.ts")) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      out.push(full);
    }
  }
  return out;
}

function inferStubFor(line) {
  const m = line.match(/export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (m) return `${m[1]} — auto-generated description placeholder.`;
  const c = line.match(/export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (c) return `${c[1]} — auto-generated description placeholder.`;
  return "auto-generated description placeholder.";
}

let touched = 0;
let added = 0;

for (const file of walk(SRC)) {
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  const out = [];
  let mutated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!IS_EXPORT_FN_LINE.test(line)) {
      out.push(line);
      continue;
    }

    // Look backward through `out` (already emitted) for the previous non-blank line.
    let hasJsDoc = false;
    for (let j = out.length - 1; j >= 0; j--) {
      const prev = out[j].trim();
      if (prev === "") continue;
      if (prev.endsWith("*/")) hasJsDoc = true;
      break;
    }

    if (hasJsDoc) {
      out.push(line);
      continue;
    }

    // Build a single-line JSDoc block at the same indentation as the export.
    const indentMatch = line.match(/^[ \t]*/);
    const indent = indentMatch ? indentMatch[0] : "";
    const stub = inferStubFor(line);
    out.push(`${indent}/** ${stub} */`);
    out.push(line);
    added += 1;
    mutated = true;
  }

  if (mutated) {
    writeFileSync(file, out.join("\n"), "utf-8");
    touched += 1;
  }
}

console.log(JSON.stringify({ touched, added }, null, 2));
