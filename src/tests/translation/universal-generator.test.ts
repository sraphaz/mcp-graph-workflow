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
 * Tests for UniversalGenerator — UCR-based code generation for all language pairs.
 *
 * Covers: filterTopLevelConstructs, transformParams, TYPE_MAP, and full pipeline.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { UniversalGenerator } from "../../core/translation/generators/universal-generator.js";
import type { ParsedConstruct } from "../../core/translation/parsers/parser-adapter.js";

function createSeededRegistry(): ConstructRegistry {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS ucr_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT
    );
    CREATE TABLE IF NOT EXISTS ucr_constructs (
      id TEXT PRIMARY KEY, category_id TEXT NOT NULL, canonical_name TEXT NOT NULL UNIQUE,
      description TEXT, semantic_group TEXT, metadata TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS ucr_language_mappings (
      id TEXT PRIMARY KEY, construct_id TEXT NOT NULL, language_id TEXT NOT NULL,
      syntax_pattern TEXT, ast_node_type TEXT, confidence REAL NOT NULL DEFAULT 0.8,
      is_primary INTEGER NOT NULL DEFAULT 0, constraints TEXT DEFAULT '[]'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS ucr_constructs_fts USING fts5(
      canonical_name, description, semantic_group,
      content='ucr_constructs', content_rowid='rowid'
    );
  `);
  const registry = new ConstructRegistry(db);
  loadAndSeedRegistry(registry);
  return registry;
}

describe("UniversalGenerator", () => {
  let registry: ConstructRegistry;

  beforeAll(() => {
    registry = createSeededRegistry();
  });

  describe("TS → Python", () => {
    it("should generate Python def from TS function", () => {
      const sourceCode = "function greet(name: string): string {\n  return name;\n}";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 3 },
      ];

      const generator = new UniversalGenerator(registry, "python", sourceCode, "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("def");
      expect(result.code).toContain("greet");
      expect(result.mappedConstructs).toContain("uc_fn_def");
      expect(result.unmappedConstructs).toHaveLength(0);
    });

    it("should generate Python return from TS return", () => {
      const sourceCode = "return 42;";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_return", startLine: 1, endLine: 1 },
      ];

      const generator = new UniversalGenerator(registry, "python", sourceCode, "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("return");
      expect(result.code).toContain("42");
      expect(result.mappedConstructs).toContain("uc_return");
    });

    it("should handle multiple constructs", () => {
      const sourceCode = "function a() { return 1; }\nfunction b() { return 2; }";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "a", startLine: 1, endLine: 1 },
        { constructId: "uc_fn_def", name: "b", startLine: 2, endLine: 2 },
      ];

      const generator = new UniversalGenerator(registry, "python", sourceCode, "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("a");
      expect(result.code).toContain("b");
      expect(result.mappedConstructs).toHaveLength(2);
    });
  });

  describe("Java → Go", () => {
    it("should generate Go func from Java method", () => {
      const sourceCode = "public String greet(String name) {\n  return name;\n}";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 3 },
      ];

      const generator = new UniversalGenerator(registry, "go", sourceCode, "java");
      const result = generator.generate(constructs);

      expect(result.code).toContain("func");
      expect(result.code).toContain("greet");
      expect(result.mappedConstructs).toContain("uc_fn_def");
    });
  });

  describe("edge cases", () => {
    it("should return empty for empty constructs", () => {
      const generator = new UniversalGenerator(registry, "python", "code", "typescript");
      const result = generator.generate([]);

      expect(result.code).toBe("");
      expect(result.mappedConstructs).toHaveLength(0);
      expect(result.unmappedConstructs).toHaveLength(0);
    });

    it("should track unmapped constructs when no UCR pattern exists", () => {
      const sourceCode = "some_unknown_thing();";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_nonexistent_fake", startLine: 1, endLine: 1 },
      ];

      const generator = new UniversalGenerator(registry, "python", sourceCode, "typescript");
      const result = generator.generate(constructs);

      expect(result.unmappedConstructs).toContain("uc_nonexistent_fake");
    });

    it("should replace unresolved {{...}} with language defaults", () => {
      const sourceCode = "class Foo {\n  bar() { return 1; }\n}";
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_class_def", name: "Foo", startLine: 1, endLine: 3 },
      ];

      const generator = new UniversalGenerator(registry, "python", sourceCode, "typescript");
      const result = generator.generate(constructs);

      // Should not contain raw {{...}} placeholders
      expect(result.code).not.toMatch(/\{\{[^}]+\}\}/);
      expect(result.code).toContain("Foo");
    });

    it("should implement GeneratorAdapter interface", () => {
      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      expect(generator.languageId).toBe("python");
      expect(typeof generator.generate).toBe("function");
    });
  });

  // ── filterTopLevelConstructs Stress Tests ──────────

  describe("filterTopLevelConstructs", () => {
    it("should filter child method inside class when parser sets endLine = startLine", () => {
      const classSource = "public class Greeter {\n  public String greet(String name) {\n    return name;\n  }\n}";
      const methodSource = "  public String greet(String name) {\n    return name;\n  }";

      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_class_def", name: "Greeter",
          startLine: 1, endLine: 1,
          sourceText: classSource,  // 5 lines -> effectiveEnd = 5
        },
        {
          constructId: "uc_fn_def", name: "greet",
          startLine: 2, endLine: 2,
          sourceText: methodSource, // 3 lines -> effectiveEnd = 4
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "java");
      const result = generator.generate(constructs);

      // Only the class should generate code (method is filtered as child)
      expect(result.code).toContain("Greeter");
      // Both should be in mappedConstructs (children tracked as mapped)
      expect(result.mappedConstructs).toContain("uc_class_def");
      expect(result.mappedConstructs).toContain("uc_fn_def");
    });

    it("should filter 3-level nesting: class > method > return", () => {
      const classSource = "public class Calculator {\n  public int add(int a, int b) {\n    return a + b;\n  }\n}";
      const methodSource = "  public int add(int a, int b) {\n    return a + b;\n  }";
      const returnSource = "    return a + b;";

      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_class_def", name: "Calculator",
          startLine: 1, endLine: 1,
          sourceText: classSource,   // 5 lines -> effectiveEnd = 5
        },
        {
          constructId: "uc_fn_def", name: "add",
          startLine: 2, endLine: 2,
          sourceText: methodSource,  // 3 lines -> effectiveEnd = 4
        },
        {
          constructId: "uc_return",
          startLine: 3, endLine: 3,
          sourceText: returnSource,  // 1 line -> effectiveEnd = 3
        },
      ];

      const generator = new UniversalGenerator(registry, "go", "", "java");
      const result = generator.generate(constructs);

      // Only top-level class generates code (1 code block, not 3)
      expect(result.code).toContain("Calculator");
      // The code should produce exactly 1 top-level block (not separate func/return blocks)
      expect(result.code).not.toContain("func add");
      // All 3 tracked as mapped
      expect(result.mappedConstructs).toHaveLength(3);
    });

    it("should keep all siblings at the same level", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "foo",
          startLine: 1, endLine: 1,
          sourceText: "function foo() {\n  return 1;\n}",  // effectiveEnd = 3
        },
        {
          constructId: "uc_fn_def", name: "bar",
          startLine: 4, endLine: 4,
          sourceText: "function bar() {\n  return 2;\n}",  // effectiveEnd = 6
        },
        {
          constructId: "uc_fn_def", name: "baz",
          startLine: 7, endLine: 7,
          sourceText: "function baz() {\n  return 3;\n}",  // effectiveEnd = 9
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("foo");
      expect(result.code).toContain("bar");
      expect(result.code).toContain("baz");
      expect(result.mappedConstructs).toHaveLength(3);
    });

    it("should pass through a single construct unchanged", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "solo",
          startLine: 1, endLine: 1,
          sourceText: "function solo() { return 0; }",
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("solo");
      expect(result.mappedConstructs).toHaveLength(1);
    });

    it("should keep all constructs when they share identical line ranges", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "alpha",
          startLine: 1, endLine: 1,
          sourceText: "function alpha() {}",  // 1 line -> effectiveEnd = 1
        },
        {
          constructId: "uc_fn_def", name: "beta",
          startLine: 1, endLine: 1,
          sourceText: "function beta() {}",   // 1 line -> effectiveEnd = 1
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      const result = generator.generate(constructs);

      // Same range = NOT strictly larger, so both survive
      expect(result.code).toContain("alpha");
      expect(result.code).toContain("beta");
      expect(result.mappedConstructs).toHaveLength(2);
    });

    it("should use endLine for filtering when sourceText is absent", () => {
      const sourceCode = "class Wrapper {\n  doStuff() {\n    return 1;\n  }\n}";

      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_class_def", name: "Wrapper",
          startLine: 1, endLine: 5,
          sourceText: sourceCode, // triggers skip of enrichment
        },
        {
          constructId: "uc_fn_def", name: "doStuff",
          startLine: 2, endLine: 4,
          // no sourceText -> textLines defaults to 1, effectiveEnd = max(4, 2) = 4
        },
      ];

      const generator = new UniversalGenerator(registry, "python", sourceCode, "typescript");
      const result = generator.generate(constructs);

      // doStuff (2-4) is inside Wrapper (1-5), so it's filtered
      expect(result.code).toContain("Wrapper");
      expect(result.mappedConstructs).toContain("uc_class_def");
      expect(result.mappedConstructs).toContain("uc_fn_def");
    });

    it("should filter child with correct endLine from TS parser", () => {
      const fnSource = "function compute(x: number): number {\n  const y = x * 2;\n  return y;\n}";

      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "compute",
          startLine: 1, endLine: 4,
          sourceText: fnSource,  // 4 lines -> effectiveEnd = max(4, 4) = 4
        },
        {
          constructId: "uc_return",
          startLine: 3, endLine: 3,
          sourceText: "  return y;", // 1 line -> effectiveEnd = 3
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      const result = generator.generate(constructs);

      // Only 1 top-level construct generated (the function, not a separate return)
      expect(result.code).toContain("compute");
      // The return construct is filtered — it should NOT produce a standalone "return {{value}}" block
      const codeBlocks = result.code.split("\n\n");
      expect(codeBlocks).toHaveLength(1);
      expect(result.mappedConstructs).toHaveLength(2);
    });

    it("should compute correct effectiveEnd for long sourceText (50+ lines)", () => {
      const bodyLines = Array.from({ length: 48 }, (_, i) => `  console.log(${i});`);
      const longFn = `function longFn() {\n${bodyLines.join("\n")}\n}`;
      // 50 lines total -> effectiveEnd = max(1, 1+50-1) = 50

      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "longFn",
          startLine: 1, endLine: 1,
          sourceText: longFn,
        },
        {
          constructId: "uc_return",
          startLine: 27, endLine: 27,
          sourceText: "  console.log(25);",
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("longFn");
      expect(result.mappedConstructs).toHaveLength(2);
    });
  });

  // ── transformParams Stress Tests ───────────────────

  describe("transformParams", () => {
    it("should strip TS type annotations for Python target", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "greet",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "greet", params: "name: string", returnType: "string", body: "return name" },
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("greet(name)");
      expect(result.code).toContain("-> str");
    });

    it("should reorder TS params to Go name-type style", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "add",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "add", params: "a: number, b: number", returnType: "number", body: "return a+b" },
        },
      ];

      const generator = new UniversalGenerator(registry, "go", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("a int, b int");
      expect(result.code).toContain("func add(");
    });

    it("should reorder TS params to Rust name-type style with Rust types", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "process",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "process", params: "x: number, s: string", returnType: "boolean", body: "return true" },
        },
      ];

      const generator = new UniversalGenerator(registry, "rust", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("x i32, s String");
      expect(result.code).toContain("-> bool");
    });

    it("should map TS params to Java types", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "calc",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "calc", params: "x: number, flag: boolean", returnType: "string", body: "return ''" },
        },
      ];

      const generator = new UniversalGenerator(registry, "java", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("calc");
      // returnType "string" -> "String" via TYPE_MAP
      expect(result.code).toContain("String");
    });

    it("should strip Java type-name params for Python target", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "greet",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "greet", params: "String name, int age", returnType: "String", body: "return name" },
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "java");
      const result = generator.generate(constructs);

      expect(result.code).toContain("greet(name, age)");
      expect(result.code).not.toContain("String");
      expect(result.code).not.toContain("int");
    });

    it("should map Java params to Go name-type style", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "process",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "process", params: "String name, int count", returnType: "void", body: "" },
        },
      ];

      const generator = new UniversalGenerator(registry, "go", "", "java");
      const result = generator.generate(constructs);

      expect(result.code).toContain("name string");
      expect(result.code).toContain("count int");
    });

    it("should convert Java params to TS colon notation", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "format",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "format", params: "String text, Boolean flag", returnType: "String", body: "return text" },
        },
      ];

      const generator = new UniversalGenerator(registry, "typescript", "", "java");
      const result = generator.generate(constructs);

      expect(result.code).toContain("text: string");
      expect(result.code).toContain("flag: boolean");
    });

    it("should handle empty params without error", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "noop",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "noop", params: "", body: "// impl" },
        },
      ];

      const generator = new UniversalGenerator(registry, "go", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("func noop()");
    });

    it("should strip multiple TS types for Python target", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "multi",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "multi", params: "a: string, b: number, c: boolean, d: any", body: "pass" },
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("multi(a, b, c, d)");
    });

    it("should strip final modifier in Java params for Python target", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "secure",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "secure", params: "final String key", body: "pass" },
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "java");
      const result = generator.generate(constructs);

      expect(result.code).toContain("secure(key)");
      expect(result.code).not.toContain("final");
      expect(result.code).not.toContain("String");
    });

    it("should strip Go name-type params for Python target", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "handle",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "handle", params: "ctx string, count int", body: "pass" },
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "go");
      const result = generator.generate(constructs);

      // Go source: "ctx string" should extract name "ctx" (not "string")
      expect(result.code).toContain("handle(ctx, count)");
    });
  });

  // ── TYPE_MAP Stress Tests ──────────────────────────

  describe("TYPE_MAP", () => {
    it("should map all known types to Python", () => {
      const typeTests = [
        { input: "string", expected: "str" },
        { input: "number", expected: "int" },
        { input: "boolean", expected: "bool" },
        { input: "void", expected: "None" },
        { input: "any", expected: "Any" },
      ];

      for (const { input, expected } of typeTests) {
        const constructs: ParsedConstruct[] = [
          {
            constructId: "uc_fn_def", name: "test",
            startLine: 1, endLine: 1,
            sourceText: "placeholder",
            resolvedPlaceholders: { name: "test", params: "", returnType: input, body: "pass" },
          },
        ];

        const generator = new UniversalGenerator(registry, "python", "", "typescript");
        const result = generator.generate(constructs);
        expect(result.code).toContain(`-> ${expected}`);
      }
    });

    it("should map all known types to Go", () => {
      const typeTests = [
        { input: "string", expected: "string" },
        { input: "number", expected: "int" },
        { input: "boolean", expected: "bool" },
        { input: "any", expected: "interface{}" },
      ];

      for (const { input, expected } of typeTests) {
        const constructs: ParsedConstruct[] = [
          {
            constructId: "uc_fn_def", name: "test",
            startLine: 1, endLine: 1,
            sourceText: "placeholder",
            resolvedPlaceholders: { name: "test", params: "", returnType: input, body: "// impl" },
          },
        ];

        const generator = new UniversalGenerator(registry, "go", "", "typescript");
        const result = generator.generate(constructs);
        expect(result.code).toContain(expected);
      }
    });

    it("should map all known types to Rust", () => {
      const typeTests = [
        { input: "string", expected: "String" },
        { input: "number", expected: "i32" },
        { input: "boolean", expected: "bool" },
        { input: "void", expected: "()" },
        { input: "float", expected: "f64" },
        { input: "double", expected: "f64" },
      ];

      for (const { input, expected } of typeTests) {
        const constructs: ParsedConstruct[] = [
          {
            constructId: "uc_fn_def", name: "test",
            startLine: 1, endLine: 1,
            sourceText: "placeholder",
            resolvedPlaceholders: { name: "test", params: "", returnType: input, body: "// impl" },
          },
        ];

        const generator = new UniversalGenerator(registry, "rust", "", "typescript");
        const result = generator.generate(constructs);
        expect(result.code).toContain(`-> ${expected}`);
      }
    });

    it("should map Python types back to TypeScript", () => {
      const typeTests = [
        { input: "str", expected: "string" },
        { input: "int", expected: "number" },
        { input: "bool", expected: "boolean" },
        { input: "None", expected: "void" },
      ];

      for (const { input, expected } of typeTests) {
        const constructs: ParsedConstruct[] = [
          {
            constructId: "uc_fn_def", name: "test",
            startLine: 1, endLine: 1,
            sourceText: "placeholder",
            resolvedPlaceholders: { name: "test", params: "", returnType: input, body: "return null" },
          },
        ];

        const generator = new UniversalGenerator(registry, "typescript", "", "python");
        const result = generator.generate(constructs);
        expect(result.code).toContain(expected);
      }
    });

    it("should pass through unknown types unchanged", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "custom",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "custom", params: "", returnType: "MyCustomType", body: "pass" },
        },
      ];

      const generator = new UniversalGenerator(registry, "python", "", "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("-> MyCustomType");
    });

    it("should map Java-style type names (Integer, Boolean) across targets", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "javaTypes",
          startLine: 1, endLine: 1,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "javaTypes", params: "", returnType: "Integer", body: "pass" },
        },
      ];

      const pyGen = new UniversalGenerator(registry, "python", "", "java");
      const pyResult = pyGen.generate(constructs);
      expect(pyResult.code).toContain("-> int");

      const goGen = new UniversalGenerator(registry, "go", "", "java");
      const goResult = goGen.generate(constructs);
      expect(goResult.code).toContain("int");
    });
  });

  // ── Full Pipeline Cross-Language Stress Tests ──────

  describe("full pipeline cross-language", () => {
    it("should translate TS class with methods to Python (only class in output)", () => {
      const sourceCode = [
        "class Calculator {",
        "  add(a: number, b: number): number {",
        "    return a + b;",
        "  }",
        "  multiply(a: number, b: number): number {",
        "    return a * b;",
        "  }",
        "}",
      ].join("\n");

      const constructs: ParsedConstruct[] = [
        { constructId: "uc_class_def", name: "Calculator", startLine: 1, endLine: 8 },
        { constructId: "uc_fn_def", name: "add", startLine: 2, endLine: 4 },
        { constructId: "uc_return", startLine: 3, endLine: 3 },
        { constructId: "uc_fn_def", name: "multiply", startLine: 5, endLine: 7 },
        { constructId: "uc_return", startLine: 6, endLine: 6 },
      ];

      const generator = new UniversalGenerator(registry, "python", sourceCode, "typescript");
      const result = generator.generate(constructs);

      // Only class should generate code — methods and returns are children
      expect(result.code).toContain("Calculator");
      expect(result.code.match(/\bclass\b/g)?.length ?? 0).toBeLessThanOrEqual(1);
      // All 5 constructs should be tracked as mapped
      expect(result.mappedConstructs).toHaveLength(5);
    });

    it("should translate Java class with method+return to Go (regex parser endLine=startLine)", () => {
      const sourceCode = [
        "public class StringUtils {",
        "  public static String reverse(String input) {",
        "    return new StringBuilder(input).reverse().toString();",
        "  }",
        "}",
      ].join("\n");

      // Simulate regex parser output: endLine = startLine for all
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_class_def", name: "StringUtils", startLine: 1, endLine: 1 },
        { constructId: "uc_fn_def", name: "reverse", startLine: 2, endLine: 2 },
        { constructId: "uc_return", startLine: 3, endLine: 3 },
      ];

      const generator = new UniversalGenerator(registry, "go", sourceCode, "java");
      const result = generator.generate(constructs);

      // After source text enrichment, class spans L1-5, method L2-4, return L3
      // Only class should generate code
      expect(result.code).toContain("StringUtils");
      expect(result.mappedConstructs).toHaveLength(3);
    });

    it("should translate TS function with typed params to Go via full pipeline", () => {
      const sourceCode = "function calculate(x: number, y: string): boolean {\n  return true;\n}";

      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "calculate", startLine: 1, endLine: 3 },
        { constructId: "uc_return", startLine: 2, endLine: 2 },
      ];

      const generator = new UniversalGenerator(registry, "go", sourceCode, "typescript");
      const result = generator.generate(constructs);

      expect(result.code).toContain("func calculate");
      // Return should be filtered as child of function
      expect(result.mappedConstructs).toHaveLength(2);
    });

    it("should translate mixed constructs filtering children correctly", () => {
      const sourceCode = [
        "function standalone() {",
        "  return 42;",
        "}",
        "class Container {",
        "  method() {",
        "    return 1;",
        "  }",
        "}",
      ].join("\n");

      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "standalone", startLine: 1, endLine: 3 },
        { constructId: "uc_return", startLine: 2, endLine: 2 },
        { constructId: "uc_class_def", name: "Container", startLine: 4, endLine: 8 },
        { constructId: "uc_fn_def", name: "method", startLine: 5, endLine: 7 },
        { constructId: "uc_return", startLine: 6, endLine: 6 },
      ];

      const generator = new UniversalGenerator(registry, "python", sourceCode, "typescript");
      const result = generator.generate(constructs);

      // standalone and Container survive; their children are filtered
      expect(result.code).toContain("standalone");
      expect(result.code).toContain("Container");
      expect(result.mappedConstructs).toHaveLength(5);
      expect(result.unmappedConstructs).toHaveLength(0);
    });

    it("should translate Go source params correctly to TypeScript", () => {
      const constructs: ParsedConstruct[] = [
        {
          constructId: "uc_fn_def", name: "greet",
          startLine: 1, endLine: 3,
          sourceText: "placeholder",
          resolvedPlaceholders: { name: "greet", params: "name string, count int", returnType: "string", body: "return name" },
        },
      ];

      const generator = new UniversalGenerator(registry, "typescript", "", "go");
      const result = generator.generate(constructs);

      // Go source params should be correctly reordered for TS: "name: string, count: number"
      expect(result.code).toContain("name: string");
      expect(result.code).toContain("count: number");
    });
  });
});
