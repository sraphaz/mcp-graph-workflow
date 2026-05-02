/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * parser-adapter is a pure interface module — no runtime behaviour to
 * exercise. The tests here verify type-level contracts: a class
 * implementing ParserAdapter satisfies the interface, and the
 * ParsedConstruct shape carries the documented fields. Light, but locks
 * the public contract for downstream parser implementations.
 */

import { describe, it, expect } from "vitest";
import type { ParserAdapter, ParsedConstruct } from "../core/translation/parsers/parser-adapter.js";

class StubParser implements ParserAdapter {
  readonly languageId = "stub";
  parseSnippet(code: string): ParsedConstruct[] {
    return [
      {
        constructId: "uc_fn_def",
        name: "stub",
        startLine: 1,
        endLine: code.split("\n").length,
        sourceText: code,
      },
    ];
  }
}

describe("ParserAdapter contract", () => {
  it("class implementing ParserAdapter satisfies the interface", () => {
    const parser: ParserAdapter = new StubParser();
    expect(parser.languageId).toBe("stub");
    expect(typeof parser.parseSnippet).toBe("function");
  });

  it("parseSnippet returns ParsedConstruct[] with documented fields", () => {
    const parser = new StubParser();
    const out = parser.parseSnippet("function f() {}\n");
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveProperty("constructId");
    expect(out[0]).toHaveProperty("startLine");
    expect(out[0]).toHaveProperty("endLine");
  });

  it("ParsedConstruct supports optional name + sourceText + resolvedPlaceholders", () => {
    const construct: ParsedConstruct = {
      constructId: "uc_class_def",
      startLine: 1,
      endLine: 10,
    };
    expect(construct.name).toBeUndefined();
    expect(construct.sourceText).toBeUndefined();
    expect(construct.resolvedPlaceholders).toBeUndefined();
  });

  it("ParsedConstruct allows resolvedPlaceholders as a string→string record", () => {
    const construct: ParsedConstruct = {
      constructId: "uc_fn_def",
      startLine: 1,
      endLine: 5,
      resolvedPlaceholders: { name: "f", body: "return 1;" },
    };
    expect(construct.resolvedPlaceholders!.name).toBe("f");
    expect(construct.resolvedPlaceholders!.body).toBe("return 1;");
  });
});
