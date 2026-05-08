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

/**
 * AST Pruner — Context Window Optimization via Information Hiding
 *
 * Prunes TypeScript file content by replacing non-relevant function/method bodies
 * with placeholder comments, keeping only signatures. This maximizes the
 * signal-to-noise ratio in the LLM context window.
 *
 * Based on:
 * - Shannon Information Theory (1948): maximize signal, minimize entropy
 * - Liskov/Parnas Information Hiding: clients depend on interfaces, not implementations
 *
 * Uses regex-based parsing (no TSC dependency) for < 100ms performance.
 */

import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "ast-pruner.ts" });

// ── Types ───────────────────────────────────────────────

export interface PruneOptions {
  /** File content to prune */
  content: string;
  /** Symbol names to keep intact (functions, classes, methods) */
  relevantSymbols: string[];
  /** If true, keep ALL exported symbol bodies intact */
  preserveExports: boolean;
}

export interface PrunedFile {
  /** Pruned content */
  content: string;
  /** Original line count */
  originalLines: number;
  /** Lines removed (replaced with placeholders) */
  prunedLines: number;
  /** Reduction percentage (0-100) */
  reductionPercent: number;
  /** Symbols whose bodies were preserved */
  preservedSymbols: string[];
  /** Symbols whose bodies were truncated */
  truncatedSymbols: string[];
}

// ── Symbol Detection ────────────────────────────────────

interface DetectedSymbol {
  name: string;
  kind: "function" | "method" | "class" | "interface" | "type";
  isExported: boolean;
  signatureStart: number; // line index (0-based)
  bodyStart: number;      // line index of opening brace
  bodyEnd: number;        // line index of closing brace
}

/**
 * Detect function/class/interface symbols with their brace ranges.
 * Uses regex + brace counting (no AST parser needed).
 */
function detectSymbols(lines: string[]): DetectedSymbol[] {
  const symbols: DetectedSymbol[] = [];

  // eslint-disable-next-line security/detect-unsafe-regex -- bounded by line-level input, no catastrophic backtracking risk
  const funcPattern = /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)/;
  // eslint-disable-next-line security/detect-unsafe-regex
  const classPattern = /^(\s*)(export\s+)?class\s+(\w+)/;
  // eslint-disable-next-line security/detect-unsafe-regex
  const interfacePattern = /^(\s*)(export\s+)?interface\s+(\w+)/;
  // eslint-disable-next-line security/detect-unsafe-regex
  const typePattern = /^(\s*)(export\s+)?type\s+(\w+)/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpMatchArray | null;

    // Functions
    match = line.match(funcPattern);
    if (match) {
      const bodyRange = findBraceRange(lines, i);
      if (bodyRange) {
        symbols.push({
          name: match[4],
          kind: "function",
          isExported: !!match[2],
          signatureStart: i,
          bodyStart: bodyRange.start,
          bodyEnd: bodyRange.end,
        });
      }
      continue;
    }

    // Classes
    match = line.match(classPattern);
    if (match) {
      const bodyRange = findBraceRange(lines, i);
      if (bodyRange) {
        symbols.push({
          name: match[3],
          kind: "class",
          isExported: !!match[2],
          signatureStart: i,
          bodyStart: bodyRange.start,
          bodyEnd: bodyRange.end,
        });
      }
      continue;
    }

    // Interfaces
    match = line.match(interfacePattern);
    if (match) {
      const bodyRange = findBraceRange(lines, i);
      if (bodyRange) {
        symbols.push({
          name: match[3],
          kind: "interface",
          isExported: !!match[2],
          signatureStart: i,
          bodyStart: bodyRange.start,
          bodyEnd: bodyRange.end,
        });
      }
      continue;
    }

    // Type aliases (single line — no body to prune)
    match = line.match(typePattern);
    if (match) {
      symbols.push({
        name: match[3],
        kind: "type",
        isExported: !!match[2],
        signatureStart: i,
        bodyStart: i,
        bodyEnd: i,
      });
    }
  }

  return symbols;
}

/**
 * Find the opening and closing brace range for a symbol starting at lineIndex.
 */
function findBraceRange(lines: string[], startLine: number): { start: number; end: number } | null {
  let depth = 0;
  let foundOpen = false;
  let openLine = -1;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        if (!foundOpen) {
          foundOpen = true;
          openLine = i;
        }
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && foundOpen) {
          return { start: openLine, end: i };
        }
      }
    }
  }

  return null;
}

// ── Pruner ──────────────────────────────────────────────

/**
 * Prune a TypeScript file, replacing non-relevant function bodies with placeholders.
 *
 * Strategy:
 * 1. Detect all symbols (functions, classes, interfaces)
 * 2. Determine which symbols to preserve (relevant + exported if preserveExports)
 * 3. Replace pruned symbol bodies with `{ /* ...N lines * / }`
 */
export function pruneFile(options: PruneOptions): PrunedFile {
  const { content, relevantSymbols, preserveExports } = options;

  if (!content || content.trim().length === 0) {
    return {
      content,
      originalLines: 0,
      prunedLines: 0,
      reductionPercent: 0,
      preservedSymbols: [],
      truncatedSymbols: [],
    };
  }

  const lines = content.split("\n");
  const originalLines = lines.length;

  // Detect symbols
  const symbols = detectSymbols(lines);

  if (symbols.length === 0) {
    // No parseable symbols — return as-is (fallback)
    return {
      content,
      originalLines,
      prunedLines: 0,
      reductionPercent: 0,
      preservedSymbols: [],
      truncatedSymbols: [],
    };
  }

  const relevantSet = new Set(relevantSymbols);
  const preservedSymbols: string[] = [];
  const truncatedSymbols: string[] = [];

  // Determine which symbols to preserve
  const symbolsToPreserve = new Set<string>();

  for (const sym of symbols) {
    const shouldPreserve =
      relevantSet.has(sym.name) ||
      (preserveExports && sym.isExported) ||
      sym.kind === "interface" && preserveExports ||
      sym.kind === "type";

    if (shouldPreserve) {
      symbolsToPreserve.add(sym.name);
      preservedSymbols.push(sym.name);
    } else if (sym.kind !== "type") {
      truncatedSymbols.push(sym.name);
    }
  }

  // Build pruned content
  const outputLines: string[] = [];
  const prunedRanges: Array<{ start: number; end: number }> = [];

  // Collect ranges to prune (non-preserved function/class bodies)
  for (const sym of symbols) {
    if (symbolsToPreserve.has(sym.name)) continue;
    if (sym.kind === "type") continue; // types have no body to prune

    // Only prune the body interior (keep signature line + closing brace)
    if (sym.bodyStart < sym.bodyEnd) {
      prunedRanges.push({ start: sym.bodyStart, end: sym.bodyEnd });
    }
  }

  // Sort ranges by start (ascending) and merge overlapping
  prunedRanges.sort((a, b) => a.start - b.start);

  let totalPrunedLines = 0;
  let i = 0;

  while (i < lines.length) {
    const pruneRange = prunedRanges.find((r) => i === r.start);

    if (pruneRange) {
      // Output the signature line (the line with the opening brace)
      const sigLine = lines[pruneRange.start];
      const bodyLineCount = pruneRange.end - pruneRange.start - 1;

      if (bodyLineCount > 0) {
        // Find indentation
        const indent = sigLine.match(/^(\s*)/)?.[1] ?? "";

        // If opening brace is on signature line, replace body
        if (sigLine.includes("{")) {
          // Extract everything before the opening brace
          const braceIdx = sigLine.indexOf("{");
          const signature = sigLine.slice(0, braceIdx + 1);
          outputLines.push(`${signature} /* ...${bodyLineCount} lines */ }`);
        } else {
          outputLines.push(sigLine);
          outputLines.push(`${indent}{ /* ...${bodyLineCount} lines */ }`);
        }

        totalPrunedLines += bodyLineCount;
      } else {
        // Single-line body — keep as-is
        outputLines.push(lines[pruneRange.start]);
        if (pruneRange.end > pruneRange.start) {
          outputLines.push(lines[pruneRange.end]);
        }
      }

      i = pruneRange.end + 1;
    } else {
      outputLines.push(lines[i]);
      i++;
    }
  }

  const prunedContent = outputLines.join("\n");
  const reductionPercent = originalLines > 0
    ? Math.round((totalPrunedLines / originalLines) * 100)
    : 0;

  log.debug("ast-pruner:prune", {
    originalLines,
    prunedLines: totalPrunedLines,
    reductionPercent,
    preserved: preservedSymbols.length,
    truncated: truncatedSymbols.length,
  });

  return {
    content: prunedContent,
    originalLines,
    prunedLines: totalPrunedLines,
    reductionPercent,
    preservedSymbols,
    truncatedSymbols,
  };
}
