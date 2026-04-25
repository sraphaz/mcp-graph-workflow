/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.4: Scaffolder de fórmula para função pura + property-based tests
 * AC1 — GIVEN formula "a+b" com domínio {a: Z>=0, b: Z>=0} WHEN scaffold THEN teste property-based valida comutatividade e associatividade
 * AC2 — GIVEN formula com domínio inconsistente WHEN scaffold THEN aborta e emite diagnóstico apontando o node
 * AC3 — GIVEN formula atualizada WHEN re-scaffold THEN apenas blocos de formula trocados; testes customizados preservados
 */

import { describe, it, expect } from "vitest";
import {
  scaffoldFormula,
  InconsistentDomainError,
  type FormulaSpec,
} from "../../core/scaffolder/formula-scaffolder.js";

const ADD_SPEC: FormulaSpec = {
  id: "node-formula-add",
  name: "add",
  expression: "a + b",
  domain: { a: "Z>=0", b: "Z>=0" },
};

describe("AC1 — property-based tests for commutativity and associativity", () => {
  it("should generate a pure TypeScript function file", () => {
    const result = scaffoldFormula(ADD_SPEC);
    expect(result.functionFile.path).toContain("add");
    expect(result.functionFile.content).toContain("export function add");
  });

  it("should include fast-check import in the generated test file", () => {
    const result = scaffoldFormula(ADD_SPEC);
    expect(result.testFile.content).toContain("fast-check");
  });

  it("should generate a commutativity property test for addition", () => {
    const result = scaffoldFormula(ADD_SPEC);
    const testContent = result.testFile.content;
    expect(testContent).toMatch(/commutativ/i);
    expect(testContent).toContain("fc.property");
  });

  it("should generate an associativity property test for addition", () => {
    const result = scaffoldFormula(ADD_SPEC);
    const testContent = result.testFile.content;
    expect(testContent).toMatch(/associativ/i);
    expect(testContent).toContain("fc.property");
  });

  it("should generate function body matching the expression", () => {
    const result = scaffoldFormula(ADD_SPEC);
    expect(result.functionFile.content).toContain("a + b");
  });

  it("should use non-negative integer arbitraries for Z>=0 domain", () => {
    const result = scaffoldFormula(ADD_SPEC);
    expect(result.testFile.content).toMatch(/nat|integer|Z>=0/i);
  });
});

describe("AC2 — inconsistent domain aborts with diagnostic", () => {
  it("should throw InconsistentDomainError when expression uses undeclared variable", () => {
    const spec: FormulaSpec = {
      id: "node-bad",
      name: "broken",
      expression: "a + c",
      domain: { a: "Z>=0" }, // 'c' missing
    };
    expect(() => scaffoldFormula(spec)).toThrow(InconsistentDomainError);
  });

  it("should include the node ID in the diagnostic error", () => {
    const spec: FormulaSpec = {
      id: "node-missing-var",
      name: "broken",
      expression: "x * y",
      domain: { x: "Z>=0" }, // 'y' missing
    };
    let err: unknown;
    try {
      scaffoldFormula(spec);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(InconsistentDomainError);
    expect((err as InconsistentDomainError).message).toContain("node-missing-var");
  });

  it("should include the undeclared variable name in the diagnostic", () => {
    const spec: FormulaSpec = {
      id: "node-x",
      name: "f",
      expression: "a + z",
      domain: { a: "Z>=0" },
    };
    let err: unknown;
    try {
      scaffoldFormula(spec);
    } catch (e) {
      err = e;
    }
    expect((err as InconsistentDomainError).message).toContain("z");
  });

  it("should not throw when all expression variables are declared in domain", () => {
    expect(() =>
      scaffoldFormula({ id: "n", name: "mul", expression: "a * b", domain: { a: "Z>=0", b: "Z>=0" } }),
    ).not.toThrow();
  });
});

describe("AC3 — re-scaffold preserves USER-CODE blocks", () => {
  it("should mark testFile.created=true on first scaffold", () => {
    const result = scaffoldFormula(ADD_SPEC);
    expect(result.testFile.created).toBe(true);
  });

  it("should mark testFile.created=false when existingTestContent is provided", () => {
    const existing = "// USER-CODE-START custom-tests\nit('custom', () => {});\n// USER-CODE-END custom-tests";
    const result = scaffoldFormula(ADD_SPEC, { existingTestContent: existing });
    expect(result.testFile.created).toBe(false);
  });

  it("should preserve USER-CODE blocks from existing test file", () => {
    const customCode = "it('should handle edge case', () => { expect(true).toBe(true); });";
    const existing = `// USER-CODE-START my-custom\n${customCode}\n// USER-CODE-END my-custom`;
    const result = scaffoldFormula(ADD_SPEC, { existingTestContent: existing });
    expect(result.testFile.content).toContain(customCode);
  });

  it("should replace the formula function block on re-scaffold when expression changes", () => {
    const r1 = scaffoldFormula(ADD_SPEC);
    const updatedSpec: FormulaSpec = { ...ADD_SPEC, expression: "a * b" };
    const r2 = scaffoldFormula(updatedSpec, { existingFunctionContent: r1.functionFile.content });
    expect(r2.functionFile.content).toContain("a * b");
    expect(r2.functionFile.content).not.toContain("a + b");
  });

  it("should list preserved block names in the result", () => {
    const existing = "// USER-CODE-START extra\nconst x = 1;\n// USER-CODE-END extra";
    const result = scaffoldFormula(ADD_SPEC, { existingTestContent: existing });
    expect(result.testFile.preservedBlocks).toContain("extra");
  });
});
