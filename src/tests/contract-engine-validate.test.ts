import { describe, it, expect } from "vitest";
import {
  validateFiles,
} from "../core/harness/contract-engine.js";

describe("ContractEngine.validateFiles() — high-level orchestrator", () => {
  it("should detect violation when core imports from cli", () => {
    const files = [
      {
        path: "src/core/foo.ts",
        content: `import { bar } from '../../cli/bar.js';\n\nexport function foo(): string { return ''; }`,
      },
    ];

    const result = validateFiles(files);

    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0].severity).toBe("error");
    expect(result.violations[0].file).toBe("src/core/foo.ts");
    expect(result.mode).toBe("regex");
  });

  it("should return zero violations for schemas importing from zod (allowed)", () => {
    const files = [
      {
        path: "src/schemas/node.ts",
        content: `import { z } from 'zod/v4';\n\nexport const NodeSchema = z.object({ id: z.string() });`,
      },
    ];

    const result = validateFiles(files);

    const importViolations = result.violations.filter((v) => v.ruleId.includes("import"));
    expect(importViolations).toHaveLength(0);
  });

  it("should return mode=regex when no LSP symbols provided", () => {
    const files = [
      {
        path: "src/core/store/sqlite-store.ts",
        content: `import { logger } from '../utils/logger.js';`,
      },
    ];

    const result = validateFiles(files);
    expect(result.mode).toBe("regex");
  });

  it("should accept custom rules in addition to built-in ones", () => {
    const files = [
      {
        path: "src/api/routes/nodes.ts",
        content: `import { SqliteStore } from '../../core/store/sqlite-store.js';`,
      },
    ];

    const customRules = [
      {
        id: "custom-api-no-direct-store",
        name: "API must not import store directly",
        type: "import_direction" as const,
        sourcePattern: "src/api/",
        forbidden: ["store/"],
        severity: "error" as const,
        description: "API routes must use service layer, not direct store access",
      },
    ];

    const result = validateFiles(files, { additionalRules: customRules });

    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.some((v) => v.ruleId === "custom-api-no-direct-store")).toBe(true);
  });

  it("should return summary with counts and file list", () => {
    const files = [
      {
        path: "src/core/a.ts",
        content: `import { x } from '../../cli/y.js';`,
      },
      {
        path: "src/core/b.ts",
        content: `import { z } from '../utils/z.js';`,
      },
    ];

    const result = validateFiles(files);

    expect(result.filesChecked).toBe(2);
    expect(result.violationCount).toBe(result.violations.length);
    expect(result.hasErrors).toBe(true);
  });

  it("should set hasErrors=false when only warnings exist", () => {
    const files = [
      {
        path: "src/core/graphStore.ts",
        content: `export const x = 1;`,
      },
    ];

    const result = validateFiles(files);

    // Should have naming warning but no errors
    const errors = result.violations.filter((v) => v.severity === "error");
    const warnings = result.violations.filter((v) => v.severity === "warning");

    expect(errors).toHaveLength(0);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.hasErrors).toBe(false);
  });
});
