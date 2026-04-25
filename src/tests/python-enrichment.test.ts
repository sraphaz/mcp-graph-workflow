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

import { describe, it, expect } from "vitest";
import {
  isDunderName,
  findDecoratedWrapper,
  extractDecorators,
  isAsyncFunction,
  extractBaseClasses,
  enrichPythonSymbol,
  type PySyntaxNodeLike,
} from "../core/code/treesitter/python-enrichment.js";

// ── Stub builders (no tree-sitter WASM needed) ───────────────────────────────
//
// The enrichment module reads from a subset of SyntaxNode (typed as
// PySyntaxNodeLike). These stubs satisfy the interface for unit tests
// without forking a WASM runtime.

interface StubOpts {
  type: string;
  text?: string;
  parent?: PySyntaxNodeLike | null;
  namedChildren?: PySyntaxNodeLike[];
  children?: PySyntaxNodeLike[];
  fieldChildren?: Record<string, PySyntaxNodeLike | null>;
}

function stub(opts: StubOpts): PySyntaxNodeLike {
  return {
    type: opts.type,
    text: opts.text,
    parent: opts.parent ?? null,
    namedChildren: opts.namedChildren,
    children: opts.children,
    childForFieldName: opts.fieldChildren
      ? (name: string) => opts.fieldChildren?.[name] ?? null
      : undefined,
  };
}

describe("isDunderName", () => {
  it("recognizes standard dunder names", () => {
    expect(isDunderName("__init__")).toBe(true);
    expect(isDunderName("__call__")).toBe(true);
    expect(isDunderName("__enter__")).toBe(true);
    expect(isDunderName("__getitem__")).toBe(true);
  });

  it("rejects non-dunder names", () => {
    expect(isDunderName("init")).toBe(false);
    expect(isDunderName("_private")).toBe(false);
    expect(isDunderName("__not_dunder")).toBe(false);
    expect(isDunderName("not_dunder__")).toBe(false);
  });

  it("rejects edge cases that look like dunders", () => {
    expect(isDunderName("__")).toBe(false);          // no name between
    expect(isDunderName("____")).toBe(false);         // empty body
    expect(isDunderName("__1__")).toBe(false);        // starts with digit
  });
});

describe("findDecoratedWrapper", () => {
  it("returns the parent when it is a decorated_definition", () => {
    const wrapper = stub({ type: "decorated_definition" });
    const inner = stub({ type: "function_definition", parent: wrapper });
    expect(findDecoratedWrapper(inner)).toBe(wrapper);
  });

  it("returns null when parent is not a decorated_definition", () => {
    const block = stub({ type: "block" });
    const inner = stub({ type: "function_definition", parent: block });
    expect(findDecoratedWrapper(inner)).toBeNull();
  });

  it("returns null when there is no parent", () => {
    const inner = stub({ type: "function_definition", parent: null });
    expect(findDecoratedWrapper(inner)).toBeNull();
  });
});

describe("extractDecorators", () => {
  it("extracts every decorator child from a wrapper", () => {
    const wrapper = stub({
      type: "decorated_definition",
      namedChildren: [
        stub({ type: "decorator", text: "@property" }),
        stub({ type: "decorator", text: "@cache" }),
        stub({ type: "function_definition" }),
      ],
    });
    expect(extractDecorators(wrapper)).toEqual(["@property", "@cache"]);
  });

  it("returns empty for a non-wrapper node", () => {
    const inner = stub({ type: "function_definition" });
    expect(extractDecorators(inner)).toEqual([]);
  });

  it("skips empty-text decorators (defensive)", () => {
    const wrapper = stub({
      type: "decorated_definition",
      namedChildren: [
        stub({ type: "decorator", text: "" }),
        stub({ type: "decorator", text: "@real" }),
      ],
    });
    expect(extractDecorators(wrapper)).toEqual(["@real"]);
  });

  it("preserves arguments verbatim for parameterized decorators", () => {
    const wrapper = stub({
      type: "decorated_definition",
      namedChildren: [
        stub({ type: "decorator", text: '@my_decorator(timeout=30, retries=3)' }),
      ],
    });
    expect(extractDecorators(wrapper)).toEqual(['@my_decorator(timeout=30, retries=3)']);
  });
});

describe("isAsyncFunction", () => {
  it("returns true when an async keyword child is present", () => {
    const node = stub({
      type: "function_definition",
      children: [stub({ type: "async" }), stub({ type: "def" }), stub({ type: "identifier", text: "foo" })],
    });
    expect(isAsyncFunction(node)).toBe(true);
  });

  it("returns false for plain def", () => {
    const node = stub({
      type: "function_definition",
      children: [stub({ type: "def" }), stub({ type: "identifier", text: "foo" })],
    });
    expect(isAsyncFunction(node)).toBe(false);
  });

  it("returns false when node is not a function_definition", () => {
    const cls = stub({
      type: "class_definition",
      children: [stub({ type: "async" })],
    });
    expect(isAsyncFunction(cls)).toBe(false);
  });
});

describe("extractBaseClasses", () => {
  it("extracts bases from class_definition.superclasses (field)", () => {
    const supers = stub({
      type: "argument_list",
      namedChildren: [
        stub({ type: "identifier", text: "Bar" }),
        stub({ type: "identifier", text: "Baz" }),
      ],
    });
    const cls = stub({
      type: "class_definition",
      fieldChildren: { superclasses: supers },
    });
    expect(extractBaseClasses(cls)).toEqual(["Bar", "Baz"]);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const supers = stub({
      type: "argument_list",
      namedChildren: [stub({ type: "identifier", text: "Bar" })],
    });
    const cls = stub({
      type: "class_definition",
      namedChildren: [stub({ type: "identifier", text: "MyClass" }), supers],
    });
    expect(extractBaseClasses(cls)).toEqual(["Bar"]);
  });

  it("preserves generic-style bases verbatim (Generic[T])", () => {
    const supers = stub({
      type: "argument_list",
      namedChildren: [stub({ type: "subscript", text: "Generic[T]" })],
    });
    const cls = stub({
      type: "class_definition",
      fieldChildren: { superclasses: supers },
    });
    expect(extractBaseClasses(cls)).toEqual(["Generic[T]"]);
  });

  it("returns empty for class with no base list", () => {
    const cls = stub({ type: "class_definition" });
    expect(extractBaseClasses(cls)).toEqual([]);
  });

  it("returns empty for non-class node", () => {
    const fn = stub({ type: "function_definition" });
    expect(extractBaseClasses(fn)).toEqual([]);
  });
});

describe("enrichPythonSymbol", () => {
  it("composes all four enrichment fields for a decorated async function", () => {
    const wrapper = stub({
      type: "decorated_definition",
      namedChildren: [
        stub({ type: "decorator", text: "@asyncio.coroutine" }),
      ],
    });
    const fn = stub({
      type: "function_definition",
      parent: wrapper,
      children: [stub({ type: "async" }), stub({ type: "def" })],
    });
    // Wire reference back: namedChildren should include the function so
    // findDecoratedWrapper can climb if needed.
    (wrapper as unknown as { namedChildren: PySyntaxNodeLike[] }).namedChildren?.push(fn);

    const r = enrichPythonSymbol(fn, "fetch_data");
    expect(r.decorators).toContain("@asyncio.coroutine");
    expect(r.isAsync).toBe(true);
    expect(r.isDunder).toBe(false);
    expect(r.baseClasses).toEqual([]);
  });

  it("flags __init__ as dunder, no decorators, not async", () => {
    const fn = stub({
      type: "function_definition",
      children: [stub({ type: "def" })],
    });
    const r = enrichPythonSymbol(fn, "__init__");
    expect(r.isDunder).toBe(true);
    expect(r.decorators).toEqual([]);
    expect(r.isAsync).toBe(false);
  });

  it("captures base classes for class_definition", () => {
    const supers = stub({
      type: "argument_list",
      namedChildren: [stub({ type: "identifier", text: "BaseModel" })],
    });
    const cls = stub({
      type: "class_definition",
      fieldChildren: { superclasses: supers },
    });
    const r = enrichPythonSymbol(cls, "User");
    expect(r.baseClasses).toEqual(["BaseModel"]);
    expect(r.decorators).toEqual([]);
    expect(r.isAsync).toBe(false);
    expect(r.isDunder).toBe(false);
  });
});
