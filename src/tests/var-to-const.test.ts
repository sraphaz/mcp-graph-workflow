/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05a — var-to-const tests.
 */

import { describe, it, expect } from "vitest";
import { varToConst } from "../core/llm/boosters/var-to-const.js";

describe("var-to-const (E6.T05a)", () => {
  it("rewrites simple var declaration to const", () => {
    const r = varToConst("var x = 1;");
    expect(r.output).toBe("const x = 1;");
    expect(r.changed).toBe(true);
    expect(r.renamed).toEqual(["x"]);
  });

  it("idempotent: already-const code stays unchanged", () => {
    const src = "const x = 1;\nconst y = 2;";
    expect(varToConst(src).changed).toBe(false);
    expect(varToConst(src).output).toBe(src);
  });

  it("skips when identifier is reassigned later", () => {
    const src = "var x = 1;\nx = 2;";
    const r = varToConst(src);
    expect(r.changed).toBe(false);
    expect(r.skipped[0].id).toBe("x");
    expect(r.skipped[0].reason).toBe("reassigned-later");
  });

  it("skips on increment/decrement reassign", () => {
    const r1 = varToConst("var i = 0;\ni++;");
    expect(r1.changed).toBe(false);
    const r2 = varToConst("var n = 10;\nn -= 3;");
    expect(r2.changed).toBe(false);
  });

  it("rewrites the unreassigned vars even when others are reassigned", () => {
    const src = ["var a = 1;", "var b = 2;", "b = 3;"].join("\n");
    const r = varToConst(src);
    expect(r.output).toContain("const a = 1;");
    expect(r.output).toContain("var b = 2;");
    expect(r.renamed).toEqual(["a"]);
  });

  it("does not match property reads (e.g. obj.x = ...)", () => {
    const src = "var x = 1;\nobj.x = 2;";
    const r = varToConst(src);
    // obj.x assignment must NOT count as reassignment of x
    expect(r.changed).toBe(true);
    expect(r.output).toContain("const x = 1;");
  });

  it("preserves indentation and spacing", () => {
    const src = "  var foo = 'bar';";
    expect(varToConst(src).output).toBe("  const foo = 'bar';");
  });

  it("returns no changes for source without 'var' keyword", () => {
    const src = "function foo() { return 1; }";
    expect(varToConst(src).changed).toBe(false);
  });
});
