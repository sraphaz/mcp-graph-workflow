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
 * Tests for PlaceholderResolver — extracts placeholder values from source text.
 */

import { describe, it, expect } from "vitest";
import { resolvePlaceholders } from "../../core/translation/generators/placeholder-resolver.js";

describe("resolvePlaceholders — function constructs (brace languages)", () => {
  it("should extract name from TS function", () => {
    const source = "function greet(name: string): string { return name; }";
    const result = resolvePlaceholders(source, "uc_fn_def", "typescript");
    expect(result.name).toBe("greet");
  });

  it("should extract params from TS function", () => {
    const source = "function greet(name: string): string { return name; }";
    const result = resolvePlaceholders(source, "uc_fn_def", "typescript");
    expect(result.params).toBe("name: string");
  });

  it("should extract body from TS function (stripped of braces)", () => {
    const source = "function greet(name: string): string { return name; }";
    const result = resolvePlaceholders(source, "uc_fn_def", "typescript");
    expect(result.body).toContain("return name;");
    expect(result.body).not.toContain("{");
  });

  it("should extract returnType from TS function", () => {
    const source = "function greet(name: string): string { return name; }";
    const result = resolvePlaceholders(source, "uc_fn_def", "typescript");
    expect(result.returnType).toBe("string");
  });

  it("should extract from multi-line TS function", () => {
    const source = [
      "function add(a: number, b: number): number {",
      "  const sum = a + b;",
      "  return sum;",
      "}",
    ].join("\n");
    const result = resolvePlaceholders(source, "uc_fn_def", "typescript");
    expect(result.name).toBe("add");
    expect(result.params).toBe("a: number, b: number");
    expect(result.returnType).toBe("number");
    expect(result.body).toContain("const sum = a + b;");
    expect(result.body).toContain("return sum;");
  });

  it("should extract from Java method", () => {
    const source = "public String greet(String name) { return name; }";
    const result = resolvePlaceholders(source, "uc_fn_def", "java");
    expect(result.name).toBe("greet");
    expect(result.params).toBe("String name");
    expect(result.body).toContain("return name;");
  });

  it("should extract from Go function", () => {
    const source = 'func greet(name string) string {\n  return "Hello " + name\n}';
    const result = resolvePlaceholders(source, "uc_fn_def", "go");
    expect(result.name).toBe("greet");
    expect(result.params).toBe("name string");
  });

  it("should extract from TS arrow function", () => {
    const source = "const greet = (name: string): string => { return name; }";
    const result = resolvePlaceholders(source, "uc_arrow_fn", "typescript");
    expect(result.name).toBe("greet");
    expect(result.params).toBe("name: string");
  });

  it("should extract from TS async function", () => {
    const source = "async function fetchData(url: string): Promise<string> { return ''; }";
    const result = resolvePlaceholders(source, "uc_async_fn", "typescript");
    expect(result.name).toBe("fetchData");
    expect(result.params).toBe("url: string");
  });

  it("should handle function with no params", () => {
    const source = "function hello(): void { console.log('hi'); }";
    const result = resolvePlaceholders(source, "uc_fn_def", "typescript");
    expect(result.name).toBe("hello");
    expect(result.params).toBe("");
    expect(result.returnType).toBe("void");
  });
});

describe("resolvePlaceholders — function constructs (indent languages)", () => {
  it("should extract name from Python def", () => {
    const source = "def greet(name):\n    return name";
    const result = resolvePlaceholders(source, "uc_fn_def", "python");
    expect(result.name).toBe("greet");
  });

  it("should extract params from Python def", () => {
    const source = "def greet(name):\n    return name";
    const result = resolvePlaceholders(source, "uc_fn_def", "python");
    expect(result.params).toBe("name");
  });

  it("should extract body from Python def (dedented)", () => {
    const source = "def greet(name):\n    return name";
    const result = resolvePlaceholders(source, "uc_fn_def", "python");
    expect(result.body).toContain("return name");
  });

  it("should extract returnType from Python with type hint", () => {
    const source = "def greet(name: str) -> str:\n    return name";
    const result = resolvePlaceholders(source, "uc_fn_def", "python");
    expect(result.returnType).toBe("str");
  });

  it("should handle Python def with multiple params", () => {
    const source = "def add(a, b):\n    return a + b";
    const result = resolvePlaceholders(source, "uc_fn_def", "python");
    expect(result.name).toBe("add");
    expect(result.params).toBe("a, b");
  });
});

describe("resolvePlaceholders — fallback", () => {
  it("should return empty record for unknown construct type", () => {
    const source = "some random code";
    const result = resolvePlaceholders(source, "uc_unknown_thing", "typescript");
    expect(Object.keys(result).length).toBe(0);
  });

  it("should return empty record for empty source text", () => {
    const result = resolvePlaceholders("", "uc_fn_def", "typescript");
    expect(result.name).toBeUndefined();
  });
});
