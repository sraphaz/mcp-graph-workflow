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
  extractCsharpModifiers,
  extractCsharpAttributes,
  extractCsharpTypeParameters,
  extractCsharpWhereConstraints,
  extractCsharpBaseTypes,
  enrichCsharpSymbol,
  hasCsharpEnrichmentSignal,
  type CsSyntaxNodeLike,
} from "../core/code/treesitter/csharp-enrichment.js";

interface StubOpts {
  type: string;
  text?: string;
  namedChildren?: CsSyntaxNodeLike[];
  children?: CsSyntaxNodeLike[];
  fieldChildren?: Record<string, CsSyntaxNodeLike | null>;
}

function stub(opts: StubOpts): CsSyntaxNodeLike {
  return {
    type: opts.type,
    text: opts.text,
    namedChildren: opts.namedChildren,
    children: opts.children,
    childForFieldName: opts.fieldChildren
      ? (name: string) => opts.fieldChildren?.[name] ?? null
      : undefined,
  };
}

describe("extractCsharpModifiers", () => {
  it("preserves source order for stacked modifiers", () => {
    const m = stub({
      type: "method_declaration",
      children: [
        stub({ type: "public" }),
        stub({ type: "static" }),
        stub({ type: "async" }),
      ],
    });
    expect(extractCsharpModifiers(m)).toEqual(["public", "static", "async"]);
  });

  it("recognizes accessibility modifiers", () => {
    const m = stub({
      type: "method_declaration",
      children: [stub({ type: "internal" }), stub({ type: "protected" })],
    });
    expect(extractCsharpModifiers(m)).toEqual(["internal", "protected"]);
  });

  it("recognizes class-level modifiers (partial, sealed, abstract)", () => {
    const cls = stub({
      type: "class_declaration",
      children: [
        stub({ type: "public" }),
        stub({ type: "partial" }),
        stub({ type: "abstract" }),
      ],
    });
    expect(extractCsharpModifiers(cls)).toEqual(["public", "partial", "abstract"]);
  });

  it("recognizes parameter-level modifiers (ref, in, out)", () => {
    const p = stub({
      type: "parameter",
      children: [stub({ type: "ref" })],
    });
    expect(extractCsharpModifiers(p)).toEqual(["ref"]);
  });

  it("recognizes C# 11+ required and file modifiers", () => {
    const cls = stub({
      type: "class_declaration",
      children: [stub({ type: "file" })],
    });
    expect(extractCsharpModifiers(cls)).toEqual(["file"]);

    const prop = stub({
      type: "property_declaration",
      children: [stub({ type: "required" })],
    });
    expect(extractCsharpModifiers(prop)).toEqual(["required"]);
  });

  it("rejects unknown tokens (defensive against grammar drift)", () => {
    const m = stub({
      type: "method_declaration",
      children: [stub({ type: "public" }), stub({ type: "weirdtoken" })],
    });
    expect(extractCsharpModifiers(m)).toEqual(["public"]);
  });

  it("returns empty when no modifier children", () => {
    const m = stub({ type: "method_declaration" });
    expect(extractCsharpModifiers(m)).toEqual([]);
  });
});

describe("extractCsharpAttributes", () => {
  it("returns the verbatim bracket form when text starts/ends with brackets", () => {
    const list = stub({ type: "attribute_list", text: "[Serializable]" });
    const cls = stub({
      type: "class_declaration",
      namedChildren: [list],
    });
    expect(extractCsharpAttributes(cls)).toEqual(["[Serializable]"]);
  });

  it("preserves complex attribute forms", () => {
    const list = stub({
      type: "attribute_list",
      text: '[Obsolete("use Bar instead", true)]',
    });
    const m = stub({
      type: "method_declaration",
      namedChildren: [list],
    });
    expect(extractCsharpAttributes(m)).toEqual(['[Obsolete("use Bar instead", true)]']);
  });

  it("synthesizes brackets when grammar emits only inner attributes", () => {
    const a = stub({ type: "attribute", text: "Conditional(\"DEBUG\")" });
    const b = stub({ type: "attribute", text: "Pure" });
    const list = stub({
      type: "attribute_list",
      // No text → fallback walks namedChildren
      namedChildren: [a, b],
    });
    const m = stub({
      type: "method_declaration",
      namedChildren: [list],
    });
    expect(extractCsharpAttributes(m)).toEqual([`[Conditional("DEBUG"), Pure]`]);
  });

  it("collects multiple attribute_lists in source order", () => {
    const l1 = stub({ type: "attribute_list", text: "[A]" });
    const l2 = stub({ type: "attribute_list", text: "[B(\"x\")]" });
    const m = stub({
      type: "method_declaration",
      namedChildren: [l1, l2],
    });
    expect(extractCsharpAttributes(m)).toEqual(["[A]", '[B("x")]']);
  });

  it("returns empty when no attribute_lists", () => {
    const m = stub({ type: "method_declaration" });
    expect(extractCsharpAttributes(m)).toEqual([]);
  });
});

describe("extractCsharpTypeParameters", () => {
  it("extracts each type parameter verbatim", () => {
    const params = stub({
      type: "type_parameter_list",
      namedChildren: [
        stub({ type: "type_parameter", text: "T" }),
        stub({ type: "type_parameter", text: "U" }),
      ],
    });
    const m = stub({
      type: "method_declaration",
      fieldChildren: { type_parameters: params },
    });
    expect(extractCsharpTypeParameters(m)).toEqual(["T", "U"]);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const params = stub({
      type: "type_parameter_list",
      namedChildren: [stub({ type: "type_parameter", text: "TKey" })],
    });
    const cls = stub({ type: "class_declaration", namedChildren: [params] });
    expect(extractCsharpTypeParameters(cls)).toEqual(["TKey"]);
  });

  it("returns empty when no type_parameter_list", () => {
    const m = stub({ type: "method_declaration" });
    expect(extractCsharpTypeParameters(m)).toEqual([]);
  });
});

describe("extractCsharpWhereConstraints", () => {
  it("extracts each constraints clause verbatim", () => {
    const c1 = stub({
      type: "type_parameter_constraints_clause",
      text: "where T : IDisposable",
    });
    const c2 = stub({
      type: "type_parameter_constraints_clause",
      text: "where U : new()",
    });
    const m = stub({
      type: "method_declaration",
      namedChildren: [c1, c2],
    });
    expect(extractCsharpWhereConstraints(m)).toEqual([
      "where T : IDisposable",
      "where U : new()",
    ]);
  });

  it("returns empty when no constraints", () => {
    const m = stub({ type: "method_declaration" });
    expect(extractCsharpWhereConstraints(m)).toEqual([]);
  });
});

describe("extractCsharpBaseTypes", () => {
  it("extracts base class + interfaces in source order", () => {
    const baseList = stub({
      type: "base_list",
      namedChildren: [
        stub({ type: "identifier_name", text: "Bar" }),
        stub({ type: "identifier_name", text: "IDisposable" }),
        stub({ type: "identifier_name", text: "ICloneable" }),
      ],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { bases: baseList },
    });
    expect(extractCsharpBaseTypes(cls)).toEqual(["Bar", "IDisposable", "ICloneable"]);
  });

  it("preserves generic forms verbatim (IList<int>)", () => {
    const baseList = stub({
      type: "base_list",
      namedChildren: [stub({ type: "generic_name", text: "IList<int>" })],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { bases: baseList },
    });
    expect(extractCsharpBaseTypes(cls)).toEqual(["IList<int>"]);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const baseList = stub({
      type: "base_list",
      namedChildren: [stub({ type: "identifier_name", text: "Object" })],
    });
    const cls = stub({ type: "class_declaration", namedChildren: [baseList] });
    expect(extractCsharpBaseTypes(cls)).toEqual(["Object"]);
  });

  it("returns empty when no base_list", () => {
    const cls = stub({ type: "class_declaration" });
    expect(extractCsharpBaseTypes(cls)).toEqual([]);
  });
});

describe("enrichCsharpSymbol", () => {
  it("returns all-empty enrichment for a bare method", () => {
    const m = stub({ type: "method_declaration" });
    expect(enrichCsharpSymbol(m)).toEqual({
      modifiers: [],
      attributes: [],
      typeParameters: [],
      whereConstraints: [],
      isAsync: false,
      baseTypes: [],
    });
  });

  it("flags async only when modifier is present on a method", () => {
    const m = stub({
      type: "method_declaration",
      children: [stub({ type: "public" }), stub({ type: "async" })],
    });
    expect(enrichCsharpSymbol(m).isAsync).toBe(true);

    const cls = stub({
      type: "class_declaration",
      children: [stub({ type: "async" })],
    });
    expect(enrichCsharpSymbol(cls).isAsync).toBe(false);
  });

  it("composes a fully-enriched generic class with attributes, modifiers, base + constraints", () => {
    const list = stub({ type: "attribute_list", text: "[Serializable]" });
    const params = stub({
      type: "type_parameter_list",
      namedChildren: [stub({ type: "type_parameter", text: "T" })],
    });
    const where = stub({
      type: "type_parameter_constraints_clause",
      text: "where T : IComparable<T>",
    });
    const baseList = stub({
      type: "base_list",
      namedChildren: [stub({ type: "identifier_name", text: "Object" })],
    });
    const cls = stub({
      type: "class_declaration",
      children: [stub({ type: "public" }), stub({ type: "sealed" })],
      namedChildren: [list, where],
      fieldChildren: { type_parameters: params, bases: baseList },
    });
    const r = enrichCsharpSymbol(cls);
    expect(r.modifiers).toEqual(["public", "sealed"]);
    expect(r.attributes).toEqual(["[Serializable]"]);
    expect(r.typeParameters).toEqual(["T"]);
    expect(r.whereConstraints).toEqual(["where T : IComparable<T>"]);
    expect(r.baseTypes).toEqual(["Object"]);
    expect(r.isAsync).toBe(false);
  });
});

describe("hasCsharpEnrichmentSignal", () => {
  it("returns false for empty payload", () => {
    expect(
      hasCsharpEnrichmentSignal({
        modifiers: [],
        attributes: [],
        typeParameters: [],
        whereConstraints: [],
        isAsync: false,
        baseTypes: [],
      }),
    ).toBe(false);
  });

  it("returns true when any field carries signal", () => {
    const empty = {
      modifiers: [] as string[],
      attributes: [] as string[],
      typeParameters: [] as string[],
      whereConstraints: [] as string[],
      isAsync: false,
      baseTypes: [] as string[],
    };
    expect(hasCsharpEnrichmentSignal({ ...empty, modifiers: ["public"] })).toBe(true);
    expect(hasCsharpEnrichmentSignal({ ...empty, attributes: ["[A]"] })).toBe(true);
    expect(hasCsharpEnrichmentSignal({ ...empty, typeParameters: ["T"] })).toBe(true);
    expect(hasCsharpEnrichmentSignal({ ...empty, whereConstraints: ["where T : new()"] })).toBe(true);
    expect(hasCsharpEnrichmentSignal({ ...empty, isAsync: true })).toBe(true);
    expect(hasCsharpEnrichmentSignal({ ...empty, baseTypes: ["Object"] })).toBe(true);
  });
});
