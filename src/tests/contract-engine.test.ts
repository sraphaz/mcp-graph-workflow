import { describe, it, expect } from "vitest";
import {
  getBuiltInRules,
  compileRulesFromMarkdown,
  validateImports,
} from "../core/harness/contract-engine.js";

describe("Contract Engine — ArchitectureRule compiler (Meyer DbC)", () => {
  describe("getBuiltInRules", () => {
    it("should return 5 built-in rules with id, name, and type", () => {
      const rules = getBuiltInRules();

      expect(rules).toHaveLength(5);

      const types = rules.map((r) => r.type);
      expect(types).toContain("import_direction");
      expect(types).toContain("no_cycle");
      expect(types).toContain("barrel_integrity");
      expect(types).toContain("naming_convention");
      expect(types).toContain("dependency_ban");

      for (const rule of rules) {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.type).toBeTruthy();
        expect(rule.severity).toMatch(/^(error|warning)$/);
      }
    });

    it("should have import_direction rule blocking core from importing cli/mcp", () => {
      const rules = getBuiltInRules();
      const importRule = rules.find((r) => r.type === "import_direction");

      expect(importRule).toBeDefined();
      expect(importRule!.name).toContain("direction");
    });
  });

  describe("compileRulesFromMarkdown", () => {
    it("should extract import_direction rule from core.md content", () => {
      const coreRulesMd = `# Core Rules

- **No framework coupling** — core must not import from \`cli/\`, \`mcp/\`, or external frameworks
- **Dependency direction** — core modules may depend on \`schemas/\` and \`utils/\`, never on \`cli/\` or \`mcp/\`
`;

      const rules = compileRulesFromMarkdown(coreRulesMd, "core.md");

      expect(rules.length).toBeGreaterThanOrEqual(1);

      const importRule = rules.find((r) => r.type === "import_direction");
      expect(importRule).toBeDefined();
      expect(importRule!.forbidden).toBeDefined();
      expect(importRule!.forbidden!).toContain("cli/");
      expect(importRule!.forbidden!).toContain("mcp/");
    });

    it("should extract naming_convention rule from typescript.md content", () => {
      const tsRulesMd = `# TypeScript Rules

- **Kebab-case files** — \`graph-store.ts\`, not \`graphStore.ts\`
- **Strict mode** — \`strict: true\` in tsconfig, no \`any\` types
`;

      const rules = compileRulesFromMarkdown(tsRulesMd, "typescript.md");

      const namingRule = rules.find((r) => r.type === "naming_convention");
      expect(namingRule).toBeDefined();
    });

    it("should return empty array for content with no extractable rules", () => {
      const rules = compileRulesFromMarkdown("# Just a title\n\nSome text.", "readme.md");
      expect(rules).toEqual([]);
    });
  });

  describe("validateImports", () => {
    it("should detect violation when core imports from cli", () => {
      const files = [
        {
          path: "src/core/store/sqlite-store.ts",
          content: `import { formatOutput } from '../../cli/formatter.js';\n\nexport function foo(): void {}`,
        },
      ];

      const rules = getBuiltInRules();
      const violations = validateImports(files, rules);

      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].ruleId).toBeTruthy();
      expect(violations[0].file).toBe("src/core/store/sqlite-store.ts");
      expect(violations[0].severity).toBe("error");
    });

    it("should return zero violations for valid imports", () => {
      const files = [
        {
          path: "src/core/store/sqlite-store.ts",
          content: `import { z } from 'zod/v4';\nimport { logger } from '../utils/logger.js';`,
        },
      ];

      const rules = getBuiltInRules();
      const violations = validateImports(files, rules);

      expect(violations).toHaveLength(0);
    });

    it("should detect any type usage as warning", () => {
      const files = [
        {
          path: "src/core/utils/foo.ts",
          content: `export function bar(x: any): any {\n  return x;\n}`,
        },
      ];

      const rules = getBuiltInRules();
      const violations = validateImports(files, rules);

      const anyViolation = violations.find((v) => v.ruleId === "dependency-ban");
      expect(anyViolation).toBeDefined();
      expect(anyViolation!.severity).toBe("warning");
    });

    it("should detect non-kebab-case filenames", () => {
      const files = [
        {
          path: "src/core/store/graphStore.ts",
          content: `export const x = 1;`,
        },
      ];

      const rules = getBuiltInRules();
      const violations = validateImports(files, rules);

      const namingViolation = violations.find((v) => v.ruleId === "naming_convention");
      expect(namingViolation).toBeDefined();
      expect(namingViolation!.file).toBe("src/core/store/graphStore.ts");
    });

    it("should allow kebab-case filenames without violations", () => {
      const files = [
        {
          path: "src/core/store/graph-store.ts",
          content: `export const x = 1;`,
        },
      ];

      const rules = getBuiltInRules();
      const violations = validateImports(files, rules).filter(
        (v) => v.ruleId === "naming_convention",
      );

      expect(violations).toHaveLength(0);
    });
  });
});
