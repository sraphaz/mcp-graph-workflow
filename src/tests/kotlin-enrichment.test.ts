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
  extractKotlinModifiers,
  isSuspendFunction,
  isExtensionFunction,
  extractKotlinAnnotations,
  extractKotlinTypeParameters,
  enrichKotlinSymbol,
  hasKotlinEnrichmentSignal,
  type KtSyntaxNodeLike,
} from "../core/code/treesitter/kotlin-enrichment.js";

interface StubOpts {
  type: string;
  text?: string;
  namedChildren?: KtSyntaxNodeLike[];
  children?: KtSyntaxNodeLike[];
  fieldChildren?: Record<string, KtSyntaxNodeLike | null>;
}

function stub(opts: StubOpts): KtSyntaxNodeLike {
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

describe("extractKotlinModifiers", () => {
  it("recognizes class modifiers via child type", () => {
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "data" }), stub({ type: "public" })],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractKotlinModifiers(cls)).toEqual(["data", "public"]);
  });

  it("falls back to child text when type isn't in the allowlist", () => {
    const mods = stub({
      type: "modifiers",
      children: [
        stub({ type: "class_modifier", text: "sealed" }),
        stub({ type: "visibility_modifier", text: "internal" }),
      ],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractKotlinModifiers(cls)).toEqual(["sealed", "internal"]);
  });

  it("recognizes Kotlin coroutine + value class + multiplatform modifiers", () => {
    const mods = stub({
      type: "modifiers",
      children: [
        stub({ type: "expect" }),
        stub({ type: "value" }),
        stub({ type: "suspend" }),
      ],
    });
    const fn = stub({
      type: "function_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractKotlinModifiers(fn)).toEqual(["expect", "value", "suspend"]);
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
    expect(extractKotlinModifiers(cls)).toEqual(["public"]);
  });

  it("returns empty when no modifiers block", () => {
    const cls = stub({ type: "class_declaration" });
    expect(extractKotlinModifiers(cls)).toEqual([]);
  });
});

describe("isSuspendFunction", () => {
  it("returns true for suspend fun", () => {
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "suspend" })],
    });
    const fn = stub({
      type: "function_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(isSuspendFunction(fn)).toBe(true);
  });

  it("returns false for plain fun", () => {
    const fn = stub({
      type: "function_declaration",
    });
    expect(isSuspendFunction(fn)).toBe(false);
  });

  it("returns false for non-function nodes (suspend keyword on a class is illegal but we don't validate)", () => {
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "suspend" })],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(isSuspendFunction(cls)).toBe(false);
  });
});

describe("isExtensionFunction", () => {
  it("returns true when function has a receiver_type field", () => {
    const recv = stub({ type: "user_type", text: "Foo" });
    const fn = stub({
      type: "function_declaration",
      fieldChildren: { receiver_type: recv },
    });
    expect(isExtensionFunction(fn)).toBe(true);
  });

  it("returns false for a regular function (no receiver)", () => {
    const fn = stub({ type: "function_declaration" });
    expect(isExtensionFunction(fn)).toBe(false);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const recv = stub({ type: "receiver_type", text: "Foo" });
    const fn = stub({ type: "function_declaration", namedChildren: [recv] });
    expect(isExtensionFunction(fn)).toBe(true);
  });

  it("returns false on non-function nodes", () => {
    const cls = stub({ type: "class_declaration" });
    expect(isExtensionFunction(cls)).toBe(false);
  });
});

describe("extractKotlinAnnotations", () => {
  it("extracts each annotation child", () => {
    const a = stub({ type: "annotation", text: "@JvmStatic" });
    const b = stub({ type: "annotation", text: '@Deprecated("use Bar")' });
    const mods = stub({
      type: "modifiers",
      namedChildren: [a, b],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractKotlinAnnotations(cls)).toEqual(["@JvmStatic", '@Deprecated("use Bar")']);
  });

  it("returns empty when no modifiers block", () => {
    const cls = stub({ type: "class_declaration" });
    expect(extractKotlinAnnotations(cls)).toEqual([]);
  });

  it("ignores non-annotation children", () => {
    const mods = stub({
      type: "modifiers",
      namedChildren: [stub({ type: "comment", text: "// hi" })],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    expect(extractKotlinAnnotations(cls)).toEqual([]);
  });
});

describe("extractKotlinTypeParameters", () => {
  it("extracts each type parameter verbatim", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [
        stub({ type: "type_parameter", text: "T" }),
        stub({ type: "type_parameter", text: "U : Comparable<U>" }),
      ],
    });
    const fn = stub({
      type: "function_declaration",
      fieldChildren: { type_parameters: params },
    });
    expect(extractKotlinTypeParameters(fn)).toEqual(["T", "U : Comparable<U>"]);
  });

  it("returns empty when no type_parameters", () => {
    const fn = stub({ type: "function_declaration" });
    expect(extractKotlinTypeParameters(fn)).toEqual([]);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const params = stub({
      type: "type_parameters",
      namedChildren: [stub({ type: "type_parameter", text: "K" })],
    });
    const fn = stub({ type: "function_declaration", namedChildren: [params] });
    expect(extractKotlinTypeParameters(fn)).toEqual(["K"]);
  });
});

describe("enrichKotlinSymbol", () => {
  it("returns all-empty enrichment for a bare class", () => {
    const cls = stub({ type: "class_declaration" });
    expect(enrichKotlinSymbol(cls)).toEqual({
      modifiers: [],
      isSuspend: false,
      isExtensionFunction: false,
      annotations: [],
      typeParameters: [],
    });
  });

  it("composes a fully-enriched suspend extension function on a generic receiver", () => {
    const ann = stub({ type: "annotation", text: "@JvmName(\"fooBar\")" });
    const mods = stub({
      type: "modifiers",
      children: [stub({ type: "public" }), stub({ type: "suspend" })],
      namedChildren: [ann],
    });
    const tparam = stub({ type: "type_parameter", text: "T" });
    const tparams = stub({ type: "type_parameters", namedChildren: [tparam] });
    const recv = stub({ type: "user_type", text: "Foo<T>" });
    const fn = stub({
      type: "function_declaration",
      fieldChildren: { modifiers: mods, type_parameters: tparams, receiver_type: recv },
    });
    const r = enrichKotlinSymbol(fn);
    expect(r.modifiers).toEqual(["public", "suspend"]);
    expect(r.isSuspend).toBe(true);
    expect(r.isExtensionFunction).toBe(true);
    expect(r.annotations).toEqual(["@JvmName(\"fooBar\")"]);
    expect(r.typeParameters).toEqual(["T"]);
  });

  it("flags a data class via class_modifier text fallback", () => {
    const mods = stub({
      type: "modifiers",
      children: [
        stub({ type: "class_modifier", text: "data" }),
        stub({ type: "visibility_modifier", text: "public" }),
      ],
    });
    const cls = stub({
      type: "class_declaration",
      fieldChildren: { modifiers: mods },
    });
    const r = enrichKotlinSymbol(cls);
    expect(r.modifiers).toEqual(["data", "public"]);
  });
});

describe("hasKotlinEnrichmentSignal", () => {
  it("returns false for empty payload", () => {
    expect(
      hasKotlinEnrichmentSignal({
        modifiers: [],
        isSuspend: false,
        isExtensionFunction: false,
        annotations: [],
        typeParameters: [],
      }),
    ).toBe(false);
  });

  it("returns true when any field carries signal", () => {
    expect(
      hasKotlinEnrichmentSignal({
        modifiers: ["data"],
        isSuspend: false,
        isExtensionFunction: false,
        annotations: [],
        typeParameters: [],
      }),
    ).toBe(true);
    expect(
      hasKotlinEnrichmentSignal({
        modifiers: [],
        isSuspend: true,
        isExtensionFunction: false,
        annotations: [],
        typeParameters: [],
      }),
    ).toBe(true);
    expect(
      hasKotlinEnrichmentSignal({
        modifiers: [],
        isSuspend: false,
        isExtensionFunction: true,
        annotations: [],
        typeParameters: [],
      }),
    ).toBe(true);
    expect(
      hasKotlinEnrichmentSignal({
        modifiers: [],
        isSuspend: false,
        isExtensionFunction: false,
        annotations: ["@JvmStatic"],
        typeParameters: [],
      }),
    ).toBe(true);
    expect(
      hasKotlinEnrichmentSignal({
        modifiers: [],
        isSuspend: false,
        isExtensionFunction: false,
        annotations: [],
        typeParameters: ["T"],
      }),
    ).toBe(true);
  });
});
