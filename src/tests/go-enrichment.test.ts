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
  extractReceiver,
  extractInterfaceMethods,
  extractTypeParams,
  enrichGoSymbol,
  hasGoEnrichmentSignal,
  type GoSyntaxNodeLike,
} from "../core/code/treesitter/go-enrichment.js";

interface StubOpts {
  type: string;
  text?: string;
  namedChildren?: GoSyntaxNodeLike[];
  children?: GoSyntaxNodeLike[];
  fieldChildren?: Record<string, GoSyntaxNodeLike | null>;
}

function stub(opts: StubOpts): GoSyntaxNodeLike {
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

describe("extractReceiver", () => {
  it("extracts pointer receiver: func (s *Server) Foo()", () => {
    const typeIdent = stub({ type: "type_identifier", text: "Server" });
    const ptr = stub({ type: "pointer_type", namedChildren: [typeIdent] });
    const decl = stub({
      type: "parameter_declaration",
      fieldChildren: { type: ptr },
    });
    const recv = stub({ type: "parameter_list", namedChildren: [decl] });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { receiver: recv },
    });
    const r = extractReceiver(method);
    expect(r).toEqual({ isPointer: true, typeName: "Server" });
  });

  it("extracts value receiver: func (s Server) Foo()", () => {
    const typeIdent = stub({ type: "type_identifier", text: "Server" });
    const decl = stub({
      type: "parameter_declaration",
      fieldChildren: { type: typeIdent },
    });
    const recv = stub({ type: "parameter_list", namedChildren: [decl] });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { receiver: recv },
    });
    const r = extractReceiver(method);
    expect(r).toEqual({ isPointer: false, typeName: "Server" });
  });

  it("returns null for non-method nodes", () => {
    const fn = stub({ type: "function_declaration" });
    expect(extractReceiver(fn)).toBeNull();
  });

  it("returns null when receiver is malformed (no parameter_declaration)", () => {
    const recv = stub({ type: "parameter_list", namedChildren: [] });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { receiver: recv },
    });
    expect(extractReceiver(method)).toBeNull();
  });

  it("returns null when receiver type cannot be resolved", () => {
    const decl = stub({ type: "parameter_declaration", namedChildren: [] });
    const recv = stub({ type: "parameter_list", namedChildren: [decl] });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { receiver: recv },
    });
    expect(extractReceiver(method)).toBeNull();
  });

  it("falls back to namedChildren when no field accessor", () => {
    const typeIdent = stub({ type: "type_identifier", text: "Cfg" });
    const decl = stub({
      type: "parameter_declaration",
      namedChildren: [typeIdent],
    });
    const recv = stub({ type: "parameter_list", namedChildren: [decl] });
    const method = stub({ type: "method_declaration", namedChildren: [recv] });
    expect(extractReceiver(method)).toEqual({ isPointer: false, typeName: "Cfg" });
  });
});

describe("extractInterfaceMethods", () => {
  it("returns method signatures from interface_type (newer grammar: method_elem)", () => {
    const m1 = stub({ type: "method_elem", text: "Read(p []byte) (n int, err error)" });
    const m2 = stub({ type: "method_elem", text: "Close() error" });
    const iface = stub({ type: "interface_type", namedChildren: [m1, m2] });
    expect(extractInterfaceMethods(iface)).toEqual([
      "Read(p []byte) (n int, err error)",
      "Close() error",
    ]);
  });

  it("returns method signatures from interface_type (older grammar: method_spec)", () => {
    const m = stub({ type: "method_spec", text: "Greet() string" });
    const iface = stub({ type: "interface_type", namedChildren: [m] });
    expect(extractInterfaceMethods(iface)).toEqual(["Greet() string"]);
  });

  it("unwraps a type_spec that contains an interface", () => {
    const m = stub({ type: "method_elem", text: "Run() error" });
    const iface = stub({ type: "interface_type", namedChildren: [m] });
    const spec = stub({ type: "type_spec", fieldChildren: { type: iface } });
    expect(extractInterfaceMethods(spec)).toEqual(["Run() error"]);
  });

  it("returns empty for non-interface", () => {
    const struct = stub({ type: "struct_type" });
    expect(extractInterfaceMethods(struct)).toEqual([]);
  });

  it("returns empty for type_spec wrapping a non-interface", () => {
    const struct = stub({ type: "struct_type" });
    const spec = stub({ type: "type_spec", fieldChildren: { type: struct } });
    expect(extractInterfaceMethods(spec)).toEqual([]);
  });

  it("returns empty for empty interface", () => {
    const iface = stub({ type: "interface_type", namedChildren: [] });
    expect(extractInterfaceMethods(iface)).toEqual([]);
  });
});

describe("extractTypeParams", () => {
  it("extracts each parameter_declaration verbatim", () => {
    const t = stub({ type: "parameter_declaration", text: "T any" });
    const u = stub({ type: "parameter_declaration", text: "U comparable" });
    const tplist = stub({
      type: "type_parameter_list",
      namedChildren: [t, u],
    });
    const fn = stub({
      type: "function_declaration",
      fieldChildren: { type_parameters: tplist },
    });
    expect(extractTypeParams(fn)).toEqual(["T any", "U comparable"]);
  });

  it("returns empty when there are no type parameters", () => {
    const fn = stub({ type: "function_declaration" });
    expect(extractTypeParams(fn)).toEqual([]);
  });

  it("falls back to namedChildren when no field accessor", () => {
    const t = stub({ type: "parameter_declaration", text: "K comparable" });
    const tplist = stub({
      type: "type_parameter_list",
      namedChildren: [t],
    });
    const fn = stub({ type: "function_declaration", namedChildren: [tplist] });
    expect(extractTypeParams(fn)).toEqual(["K comparable"]);
  });
});

describe("enrichGoSymbol", () => {
  it("composes receiver + interfaceMethods + typeParams", () => {
    const fn = stub({ type: "function_declaration" });
    const r = enrichGoSymbol(fn);
    expect(r).toEqual({ receiver: null, interfaceMethods: [], typeParams: [] });
  });

  it("flags a generic method on a pointer receiver", () => {
    const ptr = stub({
      type: "pointer_type",
      namedChildren: [stub({ type: "type_identifier", text: "Cache" })],
    });
    const decl = stub({
      type: "parameter_declaration",
      fieldChildren: { type: ptr },
    });
    const recv = stub({ type: "parameter_list", namedChildren: [decl] });
    const tparam = stub({ type: "parameter_declaration", text: "T any" });
    const tplist = stub({ type: "type_parameter_list", namedChildren: [tparam] });
    const method = stub({
      type: "method_declaration",
      fieldChildren: { receiver: recv, type_parameters: tplist },
    });
    const r = enrichGoSymbol(method);
    expect(r.receiver).toEqual({ isPointer: true, typeName: "Cache" });
    expect(r.typeParams).toEqual(["T any"]);
    expect(r.interfaceMethods).toEqual([]);
  });
});

describe("hasGoEnrichmentSignal", () => {
  it("returns false for an empty payload", () => {
    expect(
      hasGoEnrichmentSignal({ receiver: null, interfaceMethods: [], typeParams: [] }),
    ).toBe(false);
  });

  it("returns true when any field carries signal", () => {
    expect(
      hasGoEnrichmentSignal({
        receiver: { isPointer: true, typeName: "Server" },
        interfaceMethods: [],
        typeParams: [],
      }),
    ).toBe(true);
    expect(
      hasGoEnrichmentSignal({
        receiver: null,
        interfaceMethods: ["Run() error"],
        typeParams: [],
      }),
    ).toBe(true);
    expect(
      hasGoEnrichmentSignal({
        receiver: null,
        interfaceMethods: [],
        typeParams: ["T any"],
      }),
    ).toBe(true);
  });
});
