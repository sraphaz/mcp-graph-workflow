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
  scaffoldInterface,
  type InterfaceSpec,
} from "../../core/scaffolder/interface-scaffolder.js";

function buildSpec(overrides: Partial<InterfaceSpec> = {}): InterfaceSpec {
  return {
    id: "node_iface_order_book",
    name: "OrderBook",
    description: "Manage buy/sell orders.",
    methods: [
      { name: "add", params: "order: Order", returns: "Promise<void>" },
      { name: "remove", params: "id: string", returns: "Promise<boolean>" },
      { name: "list", params: "", returns: "Promise<Order[]>" },
    ],
    ...overrides,
  };
}

describe("scaffoldInterface", () => {
  describe("AC1: interface with 3 methods", () => {
    it("should generate a .ts file containing 3 method signatures", () => {
      const spec = buildSpec();

      const result = scaffoldInterface(spec);

      expect(result.interfaceFile.path).toMatch(/OrderBook\.ts$/);
      expect(result.interfaceFile.content).toContain("export interface OrderBook");
      expect(result.interfaceFile.content).toContain("add(order: Order): Promise<void>;");
      expect(result.interfaceFile.content).toContain("remove(id: string): Promise<boolean>;");
      expect(result.interfaceFile.content).toContain("list(): Promise<Order[]>;");
    });

    it("should emit 3 empty failing test stubs marked with .failing", () => {
      const spec = buildSpec();

      const result = scaffoldInterface(spec);

      expect(result.testFile.content).toContain("describe(\"OrderBook\"");
      // Each method gets an `it.failing(...)` stub
      const failingMatches = result.testFile.content.match(/it\.failing\(/g) ?? [];
      expect(failingMatches).toHaveLength(3);
      expect(result.testFile.content).toContain("add");
      expect(result.testFile.content).toContain("remove");
      expect(result.testFile.content).toContain("list");
    });

    it("should use ESM-style import with .js extension in test file", () => {
      const spec = buildSpec();

      const result = scaffoldInterface(spec);

      // ESM convention: relative imports use .js extension
      expect(result.testFile.content).toMatch(/from\s+"[^"]+\.js"/);
      expect(result.testFile.content).toContain("import type { OrderBook }");
    });
  });

  describe("AC2: re-scaffold preserves USER-CODE blocks", () => {
    it("should preserve content between USER-CODE-START and USER-CODE-END markers verbatim", () => {
      const spec = buildSpec();
      const existingContent = [
        "export interface OrderBook {",
        "  oldMethod(): void;",
        "}",
        "",
        "// USER-CODE-START:helpers",
        "export function orderBookHelper(x: number): number {",
        "  return x * 2;",
        "}",
        "// USER-CODE-END:helpers",
        "",
      ].join("\n");

      const result = scaffoldInterface(spec, { existingInterfaceContent: existingContent });

      expect(result.interfaceFile.content).toContain("// USER-CODE-START:helpers");
      expect(result.interfaceFile.content).toContain("// USER-CODE-END:helpers");
      expect(result.interfaceFile.content).toContain("export function orderBookHelper(x: number): number {");
      expect(result.interfaceFile.content).toContain("return x * 2;");
      expect(result.interfaceFile.preservedBlocks).toContain("helpers");
    });

    it("should still refresh interface signatures when preserving blocks", () => {
      const spec = buildSpec();
      const existingContent = [
        "export interface OrderBook {",
        "  staleMethod(): void;",
        "}",
        "// USER-CODE-START:util",
        "const KEEP_ME = 42;",
        "// USER-CODE-END:util",
      ].join("\n");

      const result = scaffoldInterface(spec, { existingInterfaceContent: existingContent });

      expect(result.interfaceFile.content).toContain("add(order: Order): Promise<void>;");
      expect(result.interfaceFile.content).not.toContain("staleMethod");
      expect(result.interfaceFile.content).toContain("const KEEP_ME = 42;");
    });

    it("should preserve multiple independent USER-CODE blocks", () => {
      const spec = buildSpec();
      const existingContent = [
        "// USER-CODE-START:block-a",
        "const a = 1;",
        "// USER-CODE-END:block-a",
        "",
        "// USER-CODE-START:block-b",
        "const b = 2;",
        "// USER-CODE-END:block-b",
      ].join("\n");

      const result = scaffoldInterface(spec, { existingInterfaceContent: existingContent });

      expect(result.interfaceFile.preservedBlocks).toEqual(expect.arrayContaining(["block-a", "block-b"]));
      expect(result.interfaceFile.content).toContain("const a = 1;");
      expect(result.interfaceFile.content).toContain("const b = 2;");
    });
  });

  describe("AC3: interface without tests → failing test created in src/tests/", () => {
    it("should produce a test file whose path lives under src/tests/", () => {
      const spec = buildSpec();

      const result = scaffoldInterface(spec);

      expect(result.testFile.path.startsWith("src/tests/")).toBe(true);
      expect(result.testFile.path).toMatch(/\.test\.ts$/);
    });

    it("should mark the test file as created when no existing test is supplied", () => {
      const spec = buildSpec();

      const result = scaffoldInterface(spec);

      expect(result.testFile.created).toBe(true);
    });

    it("should not overwrite an existing test file (created=false)", () => {
      const spec = buildSpec();

      const result = scaffoldInterface(spec, {
        existingTestContent: "// custom test file written by dev",
      });

      expect(result.testFile.created).toBe(false);
    });
  });

  describe("output shape", () => {
    it("returns both interfaceFile and testFile descriptors", () => {
      const spec = buildSpec();

      const result = scaffoldInterface(spec);

      expect(result).toHaveProperty("interfaceFile");
      expect(result).toHaveProperty("testFile");
      expect(typeof result.interfaceFile.content).toBe("string");
      expect(typeof result.testFile.content).toBe("string");
    });
  });
});
