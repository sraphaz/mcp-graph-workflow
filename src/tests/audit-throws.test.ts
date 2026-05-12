/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §node_d09545a25596 — Story 8: findRawThrows unit tests
 */

import { describe, it, expect } from "vitest";
import { findRawThrows } from "../../scripts/audit-catches.js";

describe("findRawThrows", () => {
  it("reports a raw throw new Error", () => {
    const src = `
function foo() {
  throw new Error("something went wrong");
}
`;
    const findings = findRawThrows(src, "foo.ts");
    expect(findings).toHaveLength(1);
    expect(findings[0]!.file).toBe("foo.ts");
    expect(findings[0]!.line).toBeGreaterThan(0);
  });

  it("does not report throw new TypedError or subclasses", () => {
    const src = `
import { InvalidArgumentError, NotFoundError } from "./errors.js";
function bar() {
  throw new InvalidArgumentError("bad arg");
  throw new NotFoundError("missing");
  throw new TypedError("x");
}
`;
    expect(findRawThrows(src, "bar.ts")).toHaveLength(0);
  });

  it("does not report throw new Error inside a line comment", () => {
    const src = `
// throw new Error("this is a comment, not real code")
const x = 1;
`;
    expect(findRawThrows(src, "comment.ts")).toHaveLength(0);
  });

  it("does not report throw new Error inside a block comment", () => {
    const src = `
/*
 * throw new Error("also a comment")
 */
const y = 2;
`;
    expect(findRawThrows(src, "block-comment.ts")).toHaveLength(0);
  });

  it("does not report throw new Error inside a string literal", () => {
    const src = `
const msg = "throw new Error('nope')";
const tpl = \`throw new Error(\${x})\`;
`;
    expect(findRawThrows(src, "string.ts")).toHaveLength(0);
  });

  it("reports multiple violations in one file", () => {
    const src = `
function a() { throw new Error("a"); }
function b() { throw new Error("b"); }
`;
    expect(findRawThrows(src, "multi.ts")).toHaveLength(2);
  });
});
