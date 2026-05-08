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
 * AstPlaceholderExtractor — AST-based extraction via web-tree-sitter.
 *
 * Replaces regex-based SourceTextExtractor + PlaceholderResolver with
 * a single AST-based module. Uses TreeSitterManager (already in project)
 * to parse source code, walks AST nodes to extract placeholder values.
 *
 * Falls back to regex-based extraction for languages without WASM grammar
 * (TypeScript, Kotlin, Swift, Scala, Dart, Haskell, Elixir).
 */

import type { ParsedConstruct } from "../parsers/parser-adapter.js";
import { TreeSitterManager } from "../../code/treesitter/treesitter-manager.js";
import { extractSourceText } from "./source-text-extractor.js";
import { resolvePlaceholders } from "./placeholder-resolver.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger({ layer: "core", source: "ast-placeholder-extractor.ts" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SyntaxNode = any;

// ── Singleton manager ─────────────────────────────

let manager: TreeSitterManager | null = null;

function getManager(): TreeSitterManager {
  if (!manager) {
    manager = new TreeSitterManager();
  }
  return manager;
}

// ── Languages with WASM grammars ──────────────────

const AST_SUPPORTED_LANGUAGES = new Set([
  "python", "go", "rust", "java", "c", "cpp", "ruby", "php", "csharp", "lua",
]);

// ── Public API ────────────────────────────────────

/**
 * Enrich ParsedConstruct[] with sourceText and resolvedPlaceholders
 * using AST-based extraction (web-tree-sitter).
 *
 * Falls back to regex for languages without WASM grammar.
 * Returns a NEW array — does not mutate input.
 */
export async function extractPlaceholdersFromAst(
  sourceCode: string,
  constructs: ParsedConstruct[],
  sourceLanguageId: string,
): Promise<ParsedConstruct[]> {
  if (constructs.length === 0) return [];

  // Try AST-based extraction if language has WASM grammar
  if (AST_SUPPORTED_LANGUAGES.has(sourceLanguageId)) {
    try {
      const mgr = getManager();
      await mgr.initialize();
      const parser = await mgr.getParser(sourceLanguageId);

      if (parser) {
        const tree = parser.parse(sourceCode);
        if (tree?.rootNode) {
          return enrichFromAst(tree.rootNode, constructs, sourceCode, sourceLanguageId);
        }
      }
    } catch (err) {
      log.warn("ast-extractor:fallback", {
        language: sourceLanguageId,
        error: String(err),
        message: "AST parsing failed, falling back to regex",
      });
    }
  }

  // Fallback: regex-based extraction
  return fallbackToRegex(sourceCode, constructs, sourceLanguageId);
}

// ── AST-based extraction ──────────────────────────

function enrichFromAst(
  rootNode: SyntaxNode,
  constructs: ParsedConstruct[],
  sourceCode: string,
  languageId: string,
): ParsedConstruct[] {
  return constructs.map((c) => {
    // Find AST node matching this construct's start line
    const astNode = findNodeAtLine(rootNode, c.startLine);
    if (!astNode) {
      // No AST node found — use regex fallback for this construct
      const regexResult = fallbackSingleConstruct(sourceCode, c, languageId);
      return regexResult;
    }

    // Extract sourceText from AST node
    const sourceText = astNode.text ?? "";

    // Extract placeholders by walking AST node fields
    const resolvedPlaceholders = extractFieldsFromNode(astNode, c.constructId, languageId);

    // Include name from construct if not resolved from AST
    if (c.name && !resolvedPlaceholders.name) {
      resolvedPlaceholders.name = c.name;
    }

    return { ...c, sourceText, resolvedPlaceholders };
  });
}

/**
 * Find the AST node at a given 1-based line number.
 * Searches for the most specific (deepest) named node at that line.
 */
function findNodeAtLine(rootNode: SyntaxNode, targetLine: number): SyntaxNode | null {
  const targetRow = targetLine - 1; // tree-sitter uses 0-based rows

  // Walk children to find the node that starts at targetRow
  let bestMatch: SyntaxNode | null = null;

  function walk(node: SyntaxNode): void {
    if (!node) return;
    const startRow = node.startPosition?.row ?? -1;
    const endRow = node.endPosition?.row ?? -1;

    if (startRow === targetRow && node.isNamed) {
      // Prefer broader nodes (function_definition over just name identifier)
      if (!bestMatch || (node.endPosition?.row ?? 0) > (bestMatch.endPosition?.row ?? 0)) {
        bestMatch = node;
      }
    }

    // Only recurse into children that overlap with target
    if (startRow <= targetRow && endRow >= targetRow) {
      const childCount = node.namedChildCount ?? node.childCount ?? 0;
      for (let i = 0; i < childCount; i++) {
        const child = node.namedChild?.(i) ?? node.child?.(i);
        if (child) walk(child);
      }
    }
  }

  walk(rootNode);
  return bestMatch;
}

/**
 * Extract placeholder values from AST node fields.
 * Uses tree-sitter's childForFieldName API for structured extraction.
 */
function extractFieldsFromNode(
  node: SyntaxNode,
  _constructId: string,
  _languageId: string,
): Record<string, string> {
  const resultValue: Record<string, string> = {};

  // Name field
  const nameNode = node.childForFieldName?.("name");
  if (nameNode) {
    resultValue.name = nameNode.text;
  }

  // Parameters field (function/method)
  const paramsNode = node.childForFieldName?.("parameters");
  if (paramsNode) {
    // Strip outer parentheses
    let params = paramsNode.text ?? "";
    if (params.startsWith("(") && params.endsWith(")")) {
      params = params.slice(1, -1).trim();
    }
    resultValue.params = params;
  }

  // Body field (function/class/if/loop)
  const bodyNode = node.childForFieldName?.("body");
  if (bodyNode) {
    let body = bodyNode.text ?? "";
    // Strip outer braces for brace languages
    if (body.startsWith("{") && body.endsWith("}")) {
      body = body.slice(1, -1).trim();
    }
    // Strip leading colon for Python
    if (body.startsWith(":")) {
      body = body.slice(1).trim();
    }
    resultValue.body = body;
    resultValue.members = body; // alias for class constructs
  }

  // Return type
  const returnTypeNode = node.childForFieldName?.("return_type") ?? node.childForFieldName?.("type");
  if (returnTypeNode) {
    let returnType = returnTypeNode.text ?? "";
    if (returnType.startsWith(":")) returnType = returnType.slice(1).trim();
    if (returnType.startsWith("->")) returnType = returnType.slice(2).trim();
    resultValue.returnType = returnType;
  }

  // Condition (if/while/for)
  const condNode = node.childForFieldName?.("condition");
  if (condNode) {
    let cond = condNode.text ?? "";
    if (cond.startsWith("(") && cond.endsWith(")")) {
      cond = cond.slice(1, -1).trim();
    }
    resultValue.condition = cond;
  }

  // Superclass (class extends)
  const superNode = node.childForFieldName?.("superclass") ?? node.childForFieldName?.("superclasses");
  if (superNode) {
    resultValue.parent = superNode.text ?? "";
  }

  // Value (variable declarations, return)
  const valueNode = node.childForFieldName?.("value") ?? node.childForFieldName?.("right");
  if (valueNode) {
    resultValue.value = valueNode.text ?? "";
    resultValue.expression = valueNode.text ?? "";
  }

  // Module (imports)
  const moduleNode = node.childForFieldName?.("module_name") ?? node.childForFieldName?.("source");
  if (moduleNode) {
    let mod = moduleNode.text ?? "";
    if (mod.startsWith("'") || mod.startsWith('"')) {
      mod = mod.slice(1, -1);
    }
    resultValue.module = mod;
  }

  return resultValue;
}

// ── Regex fallback ────────────────────────────────

function fallbackToRegex(
  sourceCode: string,
  constructs: ParsedConstruct[],
  languageId: string,
): ParsedConstruct[] {
  const enriched = extractSourceText(sourceCode, constructs, languageId);
  return enriched.map((c) => {
    const resolvedPlaceholders = c.sourceText
      ? resolvePlaceholders(c.sourceText, c.constructId, languageId)
      : {};
    if (c.name && !resolvedPlaceholders.name) {
      resolvedPlaceholders.name = c.name;
    }
    return { ...c, resolvedPlaceholders };
  });
}

function fallbackSingleConstruct(
  sourceCode: string,
  construct: ParsedConstruct,
  languageId: string,
): ParsedConstruct {
  const [enriched] = extractSourceText(sourceCode, [construct], languageId);
  const resolvedPlaceholders = enriched.sourceText
    ? resolvePlaceholders(enriched.sourceText, enriched.constructId, languageId)
    : {};
  if (enriched.name && !resolvedPlaceholders.name) {
    resolvedPlaceholders.name = enriched.name;
  }
  return { ...enriched, resolvedPlaceholders };
}
