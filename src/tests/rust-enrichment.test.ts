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
  isUnsafeNode,
  extractLifetimes,
  extractTraitImpl,
  parseDeriveAttribute,
  extractDerives,
  enrichRustSymbol,
  hasRustEnrichmentSignal,
  type RsSyntaxNodeLike,
} from "../core/code/treesitter/rust-enrichment.js";

interface StubOpts {
  type: string;
  text?: string;
  parent?: RsSyntaxNodeLike | null;
  previousSibling?: RsSyntaxNodeLike | null;
  previousNamedSibling?: RsSyntaxNodeLike | null;
  namedChildren?: RsSyntaxNodeLike[];
  children?: RsSyntaxNodeLike[];
  fieldChildren?: Record<string, RsSyntaxNodeLike | null>;
}

function stub(opts: StubOpts): RsSyntaxNodeLike {
  return {
    type: opts.type,
    text: opts.text,
    parent: opts.parent ?? null,
    previousSibling: opts.previousSibling ?? null,
    previousNamedSibling: opts.previousNamedSibling ?? null,
    namedChildren: opts.namedChildren,
    children: opts.children,
    childForFieldName: opts.fieldChildren
      ? (name: string) => opts.fieldChildren?.[name] ?? null
      : undefined,
  };
}

describe("isUnsafeNode", () => {
  it("returns true for unsafe fn", () => {
    const fn = stub({
      type: "function_item",
      children: [stub({ type: "unsafe" }), stub({ type: "fn" })],
    });
    expect(isUnsafeNode(fn)).toBe(true);
  });

  it("returns true for unsafe impl", () => {
    const im = stub({
      type: "impl_item",
      children: [stub({ type: "unsafe" }), stub({ type: "impl" })],
    });
    expect(isUnsafeNode(im)).toBe(true);
  });

  it("returns false for safe fn", () => {
    const fn = stub({
      type: "function_item",
      children: [stub({ type: "fn" })],
    });
    expect(isUnsafeNode(fn)).toBe(false);
  });

  it("returns false for unrelated node types", () => {
    const s = stub({
      type: "struct_item",
      children: [stub({ type: "unsafe" })],
    });
    expect(isUnsafeNode(s)).toBe(false);
  });
});

describe("extractLifetimes", () => {
  it("extracts each lifetime from type_parameters (field)", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [
        stub({ type: "lifetime", text: "'a" }),
        stub({ type: "lifetime", text: "'b" }),
        stub({ type: "type_identifier", text: "T" }),
      ],
    });
    const fn = stub({
      type: "function_item",
      fieldChildren: { type_parameters: params },
    });
    expect(extractLifetimes(fn)).toEqual(["'a", "'b"]);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [stub({ type: "lifetime", text: "'static" })],
    });
    const fn = stub({ type: "function_item", namedChildren: [params] });
    expect(extractLifetimes(fn)).toEqual(["'static"]);
  });

  it("returns empty when no type_parameters", () => {
    const fn = stub({ type: "function_item" });
    expect(extractLifetimes(fn)).toEqual([]);
  });

  it("ignores non-lifetime children of type_parameters", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [
        stub({ type: "type_identifier", text: "T" }),
        stub({ type: "constrained_type_parameter", text: "U: Send" }),
      ],
    });
    const fn = stub({
      type: "function_item",
      fieldChildren: { type_parameters: params },
    });
    expect(extractLifetimes(fn)).toEqual([]);
  });
});

describe("extractTraitImpl", () => {
  it("returns trait + forType for impl Trait for Type", () => {
    const im = stub({
      type: "impl_item",
      fieldChildren: {
        trait: stub({ type: "type_identifier", text: "Display" }),
        type: stub({ type: "type_identifier", text: "MyStruct" }),
      },
    });
    expect(extractTraitImpl(im)).toEqual({ trait: "Display", forType: "MyStruct" });
  });

  it("returns null for inherent impl (impl Type, no trait field)", () => {
    const im = stub({
      type: "impl_item",
      fieldChildren: {
        type: stub({ type: "type_identifier", text: "MyStruct" }),
      },
    });
    expect(extractTraitImpl(im)).toBeNull();
  });

  it("returns null for non-impl nodes", () => {
    const fn = stub({ type: "function_item" });
    expect(extractTraitImpl(fn)).toBeNull();
  });

  it("preserves generic-form trait names verbatim (e.g. From<u32>)", () => {
    const im = stub({
      type: "impl_item",
      fieldChildren: {
        trait: stub({ type: "generic_type", text: "From<u32>" }),
        type: stub({ type: "type_identifier", text: "MyType" }),
      },
    });
    expect(extractTraitImpl(im)).toEqual({ trait: "From<u32>", forType: "MyType" });
  });
});

describe("parseDeriveAttribute", () => {
  it("extracts each derive macro name", () => {
    expect(parseDeriveAttribute("#[derive(Debug, Clone)]")).toEqual(["Debug", "Clone"]);
  });

  it("trims whitespace around names", () => {
    expect(parseDeriveAttribute("#[derive(  Eq , Hash )]")).toEqual(["Eq", "Hash"]);
  });

  it("ignores trailing comma", () => {
    expect(parseDeriveAttribute("#[derive(Debug, )]")).toEqual(["Debug"]);
  });

  it("returns empty for empty derive", () => {
    expect(parseDeriveAttribute("#[derive()]")).toEqual([]);
  });

  it("returns empty for non-derive attribute", () => {
    expect(parseDeriveAttribute("#[cfg(test)]")).toEqual([]);
    expect(parseDeriveAttribute("#[serde(rename = \"x\")]")).toEqual([]);
  });

  it("rejects malformed input", () => {
    expect(parseDeriveAttribute("derive(Debug)")).toEqual([]);
    expect(parseDeriveAttribute("#[derive Debug]")).toEqual([]);
  });
});

describe("extractDerives", () => {
  it("walks previous siblings collecting derives in source order", () => {
    const attr1 = stub({ type: "attribute_item", text: "#[derive(Debug)]" });
    const attr2 = stub({
      type: "attribute_item",
      text: "#[derive(Clone, PartialEq)]",
      previousNamedSibling: attr1,
    });
    const struct = stub({
      type: "struct_item",
      previousNamedSibling: attr2,
    });
    expect(extractDerives(struct)).toEqual(["Debug", "Clone", "PartialEq"]);
  });

  it("stops at the first non-attribute sibling", () => {
    const otherFn = stub({ type: "function_item" });
    const attr = stub({
      type: "attribute_item",
      text: "#[derive(Debug)]",
      previousNamedSibling: otherFn,
    });
    const struct = stub({
      type: "struct_item",
      previousNamedSibling: attr,
    });
    expect(extractDerives(struct)).toEqual(["Debug"]);
  });

  it("returns empty when no preceding attributes", () => {
    const struct = stub({ type: "struct_item" });
    expect(extractDerives(struct)).toEqual([]);
  });

  it("ignores non-derive attributes mixed in", () => {
    const cfg = stub({ type: "attribute_item", text: "#[cfg(test)]" });
    const der = stub({
      type: "attribute_item",
      text: "#[derive(Debug)]",
      previousNamedSibling: cfg,
    });
    const fn = stub({ type: "function_item", previousNamedSibling: der });
    expect(extractDerives(fn)).toEqual(["Debug"]);
  });

  it("falls back to previousSibling when previousNamedSibling is absent", () => {
    const attr = stub({ type: "attribute_item", text: "#[derive(Copy)]" });
    const struct = stub({
      type: "struct_item",
      previousSibling: attr,
    });
    expect(extractDerives(struct)).toEqual(["Copy"]);
  });
});

describe("enrichRustSymbol", () => {
  it("returns all-empty enrichment for a plain function", () => {
    const fn = stub({
      type: "function_item",
      children: [stub({ type: "fn" })],
    });
    expect(enrichRustSymbol(fn)).toEqual({
      isUnsafe: false,
      lifetimes: [],
      traitImpl: null,
      derives: [],
    });
  });

  it("composes a fully-enriched unsafe trait impl with lifetime", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [stub({ type: "lifetime", text: "'a" })],
    });
    const im = stub({
      type: "impl_item",
      children: [stub({ type: "unsafe" }), stub({ type: "impl" })],
      fieldChildren: {
        trait: stub({ type: "type_identifier", text: "Send" }),
        type: stub({ type: "generic_type", text: "MyType<'a>" }),
        type_parameters: params,
      },
    });
    const r = enrichRustSymbol(im);
    expect(r.isUnsafe).toBe(true);
    expect(r.lifetimes).toEqual(["'a"]);
    expect(r.traitImpl).toEqual({ trait: "Send", forType: "MyType<'a>" });
  });

  it("captures derives on a struct via preceding attribute siblings", () => {
    const attr = stub({ type: "attribute_item", text: "#[derive(Debug, Clone)]" });
    const struct = stub({
      type: "struct_item",
      previousNamedSibling: attr,
    });
    const r = enrichRustSymbol(struct);
    expect(r.derives).toEqual(["Debug", "Clone"]);
  });
});

describe("hasRustEnrichmentSignal", () => {
  it("returns false for an empty payload", () => {
    expect(
      hasRustEnrichmentSignal({
        isUnsafe: false,
        lifetimes: [],
        traitImpl: null,
        derives: [],
      }),
    ).toBe(false);
  });

  it("returns true when any field carries signal", () => {
    expect(
      hasRustEnrichmentSignal({
        isUnsafe: true,
        lifetimes: [],
        traitImpl: null,
        derives: [],
      }),
    ).toBe(true);
    expect(
      hasRustEnrichmentSignal({
        isUnsafe: false,
        lifetimes: ["'a"],
        traitImpl: null,
        derives: [],
      }),
    ).toBe(true);
    expect(
      hasRustEnrichmentSignal({
        isUnsafe: false,
        lifetimes: [],
        traitImpl: { trait: "Send", forType: "X" },
        derives: [],
      }),
    ).toBe(true);
    expect(
      hasRustEnrichmentSignal({
        isUnsafe: false,
        lifetimes: [],
        traitImpl: null,
        derives: ["Debug"],
      }),
    ).toBe(true);
  });
});
