/**
 * Tests for UniversalGenerator — UCR-based code generation for all language pairs.
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
});
