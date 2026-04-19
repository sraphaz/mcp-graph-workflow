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
 * Tests for AstPlaceholderExtractor — AST-based extraction via web-tree-sitter.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TreeSitterManager,
  isTreeSitterAvailable,
  resetTreeSitterLoader,
} from "../../core/code/treesitter/treesitter-manager.js";
import { extractPlaceholdersFromAst } from "../../core/translation/generators/ast-placeholder-extractor.js";
import type { ParsedConstruct } from "../../core/translation/parsers/parser-adapter.js";

describe("AstPlaceholderExtractor", () => {
  let wasmAvailable: boolean;

  beforeAll(async () => {
    resetTreeSitterLoader();
    const manager = new TreeSitterManager();
    await manager.initialize();
    wasmAvailable = await isTreeSitterAvailable();
  });

  describe("Python function extraction", () => {
    it("should extract name from Python def via AST", async () => {
      if (!wasmAvailable) return;

      const code = "def greet(name):\n    return name";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 2 },
      ];

      const result = await extractPlaceholdersFromAst(code, constructs, "python");
      expect(result[0].sourceText).toBeDefined();
      expect(result[0].sourceText).toContain("def greet");
    });

    it("should extract name from Python class via AST", async () => {
      if (!wasmAvailable) return;

      const code = "class Foo:\n    def bar(self):\n        return 1";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_class_def", name: "Foo", startLine: 1, endLine: 3 },
      ];

      const result = await extractPlaceholdersFromAst(code, constructs, "python");
      expect(result[0].sourceText).toContain("class Foo");
    });
  });

  describe("Java function extraction", () => {
    it("should extract from Java method via AST", async () => {
      if (!wasmAvailable) return;

      const code = "class Main {\n  public String greet(String name) {\n    return name;\n  }\n}";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_class_def", name: "Main", startLine: 1, endLine: 5 },
      ];

      const result = await extractPlaceholdersFromAst(code, constructs, "java");
      expect(result[0].sourceText).toContain("class Main");
    });
  });

  describe("Go function extraction", () => {
    it("should extract from Go func via AST", async () => {
      if (!wasmAvailable) return;

      const code = 'package main\n\nfunc hello() string {\n  return "hi"\n}';
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "hello", startLine: 3, endLine: 5 },
      ];

      const result = await extractPlaceholdersFromAst(code, constructs, "go");
      expect(result[0].sourceText).toContain("func hello");
    });
  });

  describe("fallback to regex", () => {
    it("should fall back to regex for unsupported language (typescript — no WASM)", async () => {
      const code = "function greet(name: string): string {\n  return name;\n}";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 3 },
      ];

      // TypeScript has no WASM grammar — should fall back to regex extractor
      const result = await extractPlaceholdersFromAst(code, constructs, "typescript");
      expect(result[0].sourceText).toBeDefined();
      expect(result[0].sourceText).toContain("function greet");
    });

    it("should fall back for unknown language", async () => {
      const code = "some code here";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "foo", startLine: 1, endLine: 1 },
      ];

      const result = await extractPlaceholdersFromAst(code, constructs, "brainfuck");
      expect(result[0].sourceText).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty constructs array", async () => {
      const result = await extractPlaceholdersFromAst("code", [], "python");
      expect(result).toHaveLength(0);
    });

    it("should handle empty source code", async () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "x", startLine: 1, endLine: 1 },
      ];

      const result = await extractPlaceholdersFromAst("", constructs, "python");
      expect(result[0].sourceText).toBeDefined();
    });

    it("should enrich resolvedPlaceholders field on constructs", async () => {
      if (!wasmAvailable) return;

      const code = "def greet(name):\n    return name";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 2 },
      ];

      const result = await extractPlaceholdersFromAst(code, constructs, "python");
      // Should have resolvedPlaceholders with at least name
      expect(result[0].resolvedPlaceholders).toBeDefined();
      expect(result[0].resolvedPlaceholders?.name).toBe("greet");
    });

    it("should not mutate original constructs", async () => {
      const code = "def foo():\n    pass";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "foo", startLine: 1, endLine: 2 },
      ];

      await extractPlaceholdersFromAst(code, constructs, "python");
      expect(constructs[0].sourceText).toBeUndefined();
      expect(constructs[0].resolvedPlaceholders).toBeUndefined();
    });
  });
});
