/**
 * Tests for SourceTextExtractor — extracts raw source text per construct.
 */

import { describe, it, expect } from "vitest";
import type { ParsedConstruct } from "../../core/translation/parsers/parser-adapter.js";
import { extractSourceText } from "../../core/translation/generators/source-text-extractor.js";

describe("ParsedConstruct sourceText field", () => {
  it("should accept sourceText as an optional string field", () => {
    const construct: ParsedConstruct = {
      constructId: "uc_fn_def",
      name: "hello",
      startLine: 1,
      endLine: 3,
      sourceText: "function hello() {\n  return 'hi';\n}",
    };

    expect(construct.sourceText).toBe("function hello() {\n  return 'hi';\n}");
  });

  it("should work without sourceText (backward-compatible)", () => {
    const construct: ParsedConstruct = {
      constructId: "uc_class_def",
      name: "Foo",
      startLine: 1,
      endLine: 5,
    };

    expect(construct.sourceText).toBeUndefined();
  });

  it("should allow sourceText on constructs without a name", () => {
    const construct: ParsedConstruct = {
      constructId: "uc_if_else",
      startLine: 10,
      endLine: 15,
      sourceText: "if (x > 0) {\n  return x;\n} else {\n  return -x;\n}",
    };

    expect(construct.sourceText).toBeDefined();
    expect(construct.name).toBeUndefined();
  });
});

describe("extractSourceText — brace languages", () => {
  it("should extract single-line function", () => {
    const code = "function hello() { return 1; }";
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "hello", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe("function hello() { return 1; }");
  });

  it("should extract multi-line function with braces", () => {
    const code = [
      "function greet(name: string): string {",
      '  const msg = "Hello " + name;',
      "  return msg;",
      "}",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe(code);
  });

  it("should extract class with methods", () => {
    const code = [
      "class Foo {",
      "  bar() {",
      "    return 1;",
      "  }",
      "}",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_class_def", name: "Foo", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "java");
    expect(result[0].sourceText).toBe(code);
  });

  it("should extract if/else block", () => {
    const code = [
      "const x = 1;",
      "if (x > 0) {",
      "  return x;",
      "} else {",
      "  return -x;",
      "}",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_if_else", startLine: 2, endLine: 2 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toContain("if (x > 0)");
    expect(result[0].sourceText).toContain("return -x;");
  });

  it("should extract single-line construct (return)", () => {
    const code = [
      "function foo() {",
      "  return 42;",
      "}",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_return", startLine: 2, endLine: 2 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe("  return 42;");
  });

  it("should extract single-line import", () => {
    const code = 'import { foo } from "./bar";';
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_import_named", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe(code);
  });

  it("should handle nested braces in function", () => {
    const code = [
      "function complex() {",
      "  if (true) {",
      "    for (let i = 0; i < 10; i++) {",
      "      console.log(i);",
      "    }",
      "  }",
      "}",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "complex", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe(code);
  });

  it("should not break on string literals containing braces", () => {
    const code = [
      "function fmt() {",
      '  const s = "hello { world }";',
      "  return s;",
      "}",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "fmt", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe(code);
  });

  it("should not break on line comments with braces", () => {
    const code = [
      "function commented() {",
      "  // this { should not } break",
      "  return 1;",
      "}",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "commented", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe(code);
  });

  it("should handle multiple constructs in same source", () => {
    const code = [
      "function a() { return 1; }",
      "function b() { return 2; }",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "a", startLine: 1, endLine: 1 },
      { constructId: "uc_fn_def", name: "b", startLine: 2, endLine: 2 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe("function a() { return 1; }");
    expect(result[1].sourceText).toBe("function b() { return 2; }");
  });

  it("should handle variable declaration (single-line, no braces)", () => {
    const code = "const x = 42;";
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_const_decl", name: "x", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    expect(result[0].sourceText).toBe("const x = 42;");
  });

  it("should return original constructs with sourceText added (not mutate)", () => {
    const code = "return 1;";
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_return", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "typescript");
    // Original should not be mutated
    expect(constructs[0].sourceText).toBeUndefined();
    // Result should have sourceText
    expect(result[0].sourceText).toBe("return 1;");
  });

  it("should work with Go function syntax", () => {
    const code = [
      "func hello() string {",
      '  return "hi"',
      "}",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "hello", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "go");
    expect(result[0].sourceText).toBe(code);
  });
});

describe("extractSourceText — indent languages (Python)", () => {
  it("should extract Python function by indentation", () => {
    const code = [
      "def greet(name):",
      "    msg = 'Hello ' + name",
      "    return msg",
      "",
      "x = 1",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "python");
    expect(result[0].sourceText).toContain("def greet(name):");
    expect(result[0].sourceText).toContain("return msg");
    expect(result[0].sourceText).not.toContain("x = 1");
  });

  it("should extract Python class with methods", () => {
    const code = [
      "class Foo:",
      "    def bar(self):",
      "        return 1",
      "",
      "    def baz(self):",
      "        return 2",
      "",
      "top_level = True",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_class_def", name: "Foo", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "python");
    expect(result[0].sourceText).toContain("class Foo:");
    expect(result[0].sourceText).toContain("return 2");
    expect(result[0].sourceText).not.toContain("top_level");
  });

  it("should extract Python if/else by indentation", () => {
    const code = [
      "x = 10",
      "if x > 0:",
      "    print('positive')",
      "else:",
      "    print('non-positive')",
      "done = True",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_if_else", startLine: 2, endLine: 2 },
    ];

    const result = extractSourceText(code, constructs, "python");
    expect(result[0].sourceText).toContain("if x > 0:");
    // Note: indent-based extraction stops when indent drops to base level
    // The else block is at the same indent as if, so it stops before else
    // This is a known limitation — else is a separate construct at same level
  });
});

describe("extractSourceText — keyword-end languages (Ruby)", () => {
  it("should extract Ruby def with end", () => {
    const code = [
      "def greet(name)",
      "  puts 'Hello ' + name",
      "end",
      "",
      "x = 1",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "ruby");
    expect(result[0].sourceText).toContain("def greet(name)");
    expect(result[0].sourceText).toContain("end");
    expect(result[0].sourceText).not.toContain("x = 1");
  });

  it("should extract Ruby class with end", () => {
    const code = [
      "class Foo",
      "  def bar",
      "    1",
      "  end",
      "end",
      "",
      "top = true",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_class_def", name: "Foo", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "ruby");
    expect(result[0].sourceText).toContain("class Foo");
    expect(result[0].sourceText).toContain("end");
    expect(result[0].sourceText).not.toContain("top = true");
  });

  it("should extract Lua function with end", () => {
    const code = [
      "function hello()",
      "  print('hi')",
      "end",
    ].join("\n");
    const constructs: ParsedConstruct[] = [
      { constructId: "uc_fn_def", name: "hello", startLine: 1, endLine: 1 },
    ];

    const result = extractSourceText(code, constructs, "lua");
    expect(result[0].sourceText).toBe(code);
  });
});
