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
  extractAnnotations,
  extractModifiers,
  extractTypeParameters,
  extractThrowsClause,
  enrichJavaSymbol,
  hasJavaEnrichmentSignal,
  type JavaSyntaxNodeLike,
} from "../core/code/treesitter/java-enrichment.js";

interface StubOpts {
  type: string;
  text?: string;
  namedChildren?: JavaSyntaxNodeLike[];
  children?: JavaSyntaxNodeLike[];
  fieldChildren?: Record<string, JavaSyntaxNodeLike | null>;
}

function stub(opts: StubOpts): JavaSyntaxNodeLike {
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

describe("extractAnnotations", () => {
  it("extracts a marker_annotation (e.g. @Override)", () => {
    const ann = stub({ type: "marker_annotation", text: "@Override" });
    const mods = stub({ type: "modifiers", namedChildren: [ann] });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractAnnotations(method)).toEqual(["@Override"]);
  });

  it("extracts single_element_annotation verbatim (e.g. @SuppressWarnings(\"x\"))", () => {
    const ann = stub({
      type: "single_element_annotation",
      text: '@SuppressWarnings("unchecked")',
    });
    const mods = stub({ type: "modifiers", namedChildren: [ann] });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractAnnotations(method)).toEqual(['@SuppressWarnings("unchecked")']);
  });

  it("extracts the multi-element annotation form (@Foo(a = 1, b = \"x\"))", () => {
    const ann = stub({ type: "annotation", text: "@Foo(a = 1, b = \"x\")" });
    const mods = stub({ type: "modifiers", namedChildren: [ann] });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractAnnotations(cls)).toEqual(['@Foo(a = 1, b = "x")']);
  });

  it("preserves source order for stacked annotations", () => {
    const a = stub({ type: "marker_annotation", text: "@Override" });
    const b = stub({ type: "marker_annotation", text: "@Deprecated" });
    const mods = stub({ type: "modifiers", namedChildren: [a, b] });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractAnnotations(method)).toEqual(["@Override", "@Deprecated"]);
  });

  it("returns empty when no modifiers block is present", () => {
    const method = stub({ type: "method_declaration" });
    expect(extractAnnotations(method)).toEqual([]);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const ann = stub({ type: "marker_annotation", text: "@Override" });
    const mods = stub({ type: "modifiers", namedChildren: [ann] });
    const method = stub({
      type: "method_declaration",
      namedChildren: [mods],
    });
    expect(extractAnnotations(method)).toEqual(["@Override"]);
  });

  it("ignores non-annotation children of modifiers", () => {
    const mods = stub({
      type: "modifiers",
      namedChildren: [stub({ type: "comment", text: "// hi" })],
    });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractAnnotations(method)).toEqual([]);
  });
});

describe("extractModifiers", () => {
  it("extracts standard modifiers in source order", () => {
    const mods = stub({
      type: "modifiers",
      children: [
        stub({ type: "public" }),
        stub({ type: "static" }),
        stub({ type: "final" }),
      ],
    });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractModifiers(method)).toEqual(["public", "static", "final"]);
  });

  it("extracts abstract on a class", () => {
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "public" }), stub({ type: "abstract" })],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractModifiers(cls)).toEqual(["public", "abstract"]);
  });

  it("recognizes Java 17+ sealed and non-sealed", () => {
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "public" }), stub({ type: "sealed" })],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractModifiers(cls)).toEqual(["public", "sealed"]);
  });

  it("ignores annotations (those go in extractAnnotations)", () => {
    const ann = stub({ type: "marker_annotation", text: "@Override" });
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "public" }), stub({ type: "static" })],
      namedChildren: [ann],
    });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractModifiers(method)).toEqual(["public", "static"]);
  });

  it("returns empty for nodes with no modifiers block", () => {
    const cls = stub({ type: "class_declaration" });
    expect(extractModifiers(cls)).toEqual([]);
  });

  it("rejects unknown tokens (defensive against grammar drift)", () => {
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "public" }), stub({ type: "weirdtoken" })],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractModifiers(cls)).toEqual(["public"]);
  });
});

describe("extractTypeParameters", () => {
  it("extracts simple type parameters", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [
        stub({ type: "type_parameter", text: "T" }),
        stub({ type: "type_parameter", text: "U" }),
      ],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { type_parameters: params },
    });
    expect(extractTypeParameters(cls)).toEqual(["T", "U"]);
  });

  it("preserves bounded forms verbatim (T extends Comparable<T>)", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [
        stub({ type: "type_parameter", text: "T extends Comparable<T>" }),
      ],
    });
    const m = stub({
      type: "method_declaration",
      fieldChildren: { type_parameters: params },
    });
    expect(extractTypeParameters(m)).toEqual(["T extends Comparable<T>"]);
  });

  it("returns empty when no type_parameters", () => {
    const m = stub({ type: "method_declaration" });
    expect(extractTypeParameters(m)).toEqual([]);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [stub({ type: "type_parameter", text: "K" })],
    });
    const m = stub({ type: "method_declaration", namedChildren: [params] });
    expect(extractTypeParameters(m)).toEqual(["K"]);
  });
});

describe("extractThrowsClause", () => {
  it("extracts each exception type", () => {
    const thr = stub({
      type: "throws",
      namedChildren: [
        stub({ type: "type_identifier", text: "IOException" }),
        stub({ type: "type_identifier", text: "SQLException" }),
      ],
    });
    const m = stub({
      type: "method_declaration",
      namedChildren: [thr],
    });
    expect(extractThrowsClause(m)).toEqual(["IOException", "SQLException"]);
  });

  it("preserves generic exception types verbatim (MyException<T>)", () => {
    const thr = stub({
      type: "throws",
      namedChildren: [stub({ type: "generic_type", text: "MyException<T>" })],
    });
    const m = stub({ type: "method_declaration", namedChildren: [thr] });
    expect(extractThrowsClause(m)).toEqual(["MyException<T>"]);
  });

  it("returns empty when no throws clause", () => {
    const m = stub({ type: "method_declaration" });
    expect(extractThrowsClause(m)).toEqual([]);
  });
});

describe("enrichJavaSymbol", () => {
  it("returns all-empty enrichment for a bare class with no modifiers", () => {
    const cls = stub({ type: "class_declaration" });
    expect(enrichJavaSymbol(cls)).toEqual({
      annotations: [],
      modifiers: [],
      typeParameters: [],
      throwsClause: [],
    });
  });

  it("composes a fully-enriched method (annotations + modifiers + generics + throws)", () => {
    const ann = stub({ type: "marker_annotation", text: "@Override" });
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "public" }), stub({ type: "final" })],
      namedChildren: [ann],
    });
    const params = stub({
      type: "type_parameters",
      namedChildren: [stub({ type: "type_parameter", text: "T" })],
    });
    const thr = stub({
      type: "throws",
      namedChildren: [stub({ type: "type_identifier", text: "IOException" })],
    });
    const m = stub({
      type: "method_declaration",
      fieldChildren: { modifiers: mods, type_parameters: params },
      namedChildren: [thr],
    });
    const r = enrichJavaSymbol(m);
    expect(r.annotations).toEqual(["@Override"]);
    expect(r.modifiers).toEqual(["public", "final"]);
    expect(r.typeParameters).toEqual(["T"]);
    expect(r.throwsClause).toEqual(["IOException"]);
  });
});

describe("hasJavaEnrichmentSignal", () => {
  it("returns false for an empty payload", () => {
    expect(
      hasJavaEnrichmentSignal({
        annotations: [],
        modifiers: [],
        typeParameters: [],
        throwsClause: [],
      }),
    ).toBe(false);
  });

  it("returns true when any field carries signal", () => {
    expect(
      hasJavaEnrichmentSignal({
        annotations: ["@Override"],
        modifiers: [],
        typeParameters: [],
        throwsClause: [],
      }),
    ).toBe(true);
    expect(
      hasJavaEnrichmentSignal({
        annotations: [],
        modifiers: ["public"],
        typeParameters: [],
        throwsClause: [],
      }),
    ).toBe(true);
    expect(
      hasJavaEnrichmentSignal({
        annotations: [],
        modifiers: [],
        typeParameters: ["T"],
        throwsClause: [],
      }),
    ).toBe(true);
    expect(
      hasJavaEnrichmentSignal({
        annotations: [],
        modifiers: [],
        typeParameters: [],
        throwsClause: ["IOException"],
      }),
    ).toBe(true);
  });
});
