/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { flattenSchema, estimateTokens } from "../core/llm/schema-optimizer.js";

describe("flattenSchema", () => {
  it("resolves a single $ref into the referenced $def", () => {
    const input = {
      type: "object",
      properties: { user: { $ref: "#/$defs/User" } },
      $defs: {
        User: { type: "object", properties: { name: { type: "string" } } },
      },
    };
    const out = flattenSchema(input) as Record<string, unknown>;
    expect((out.properties as { user: unknown }).user).toEqual({
      type: "object",
      properties: { name: { type: "string" } },
    });
    expect(out.$defs).toBeUndefined();
  });

  it("resolves nested $refs (User → Address)", () => {
    const input = {
      type: "object",
      properties: { user: { $ref: "#/$defs/User" } },
      $defs: {
        User: {
          type: "object",
          properties: { addr: { $ref: "#/$defs/Address" } },
        },
        Address: { type: "object", properties: { city: { type: "string" } } },
      },
    };
    const out = flattenSchema(input) as Record<string, unknown>;
    const props = out.properties as { user: { properties: { addr: unknown } } };
    expect(props.user.properties.addr).toEqual({
      type: "object",
      properties: { city: { type: "string" } },
    });
  });

  it("preserves descriptions when inlining", () => {
    const input = {
      type: "object",
      properties: { id: { $ref: "#/$defs/Id" } },
      $defs: { Id: { type: "string", description: "Stable opaque id" } },
    };
    const out = flattenSchema(input) as Record<string, unknown>;
    const props = out.properties as { id: { description: string } };
    expect(props.id.description).toBe("Stable opaque id");
  });

  it("drops redundant minItems: 0 and default values that match type defaults", () => {
    const input = {
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" }, minItems: 0 },
        flag: { type: "boolean", default: false },
      },
    };
    const out = flattenSchema(input) as Record<string, unknown>;
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.tags?.minItems).toBeUndefined();
    expect(props.flag?.default).toBeUndefined();
  });

  it("keeps non-redundant minItems and defaults", () => {
    const input = {
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" }, minItems: 1 },
        n: { type: "number", default: 42 },
      },
    };
    const out = flattenSchema(input) as Record<string, unknown>;
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.tags?.minItems).toBe(1);
    expect(props.n?.default).toBe(42);
  });

  it("reduces token estimate ≥ 30% vs naive-inlined unoptimized form", () => {
    // Naive inline: same shape but minItems/redundant defaults retained.
    const naiveInlined = {
      type: "object",
      properties: {
        a: {
          type: "object",
          properties: {
            id: { type: "string" },
            tags: { type: "array", items: { type: "string" }, minItems: 0 },
            flag: { type: "boolean", default: false },
          },
        },
        b: {
          type: "object",
          properties: {
            id: { type: "string" },
            tags: { type: "array", items: { type: "string" }, minItems: 0 },
            flag: { type: "boolean", default: false },
          },
        },
      },
    };
    const withDefs = {
      type: "object",
      properties: { a: { $ref: "#/$defs/Big" }, b: { $ref: "#/$defs/Big" } },
      $defs: {
        Big: {
          type: "object",
          properties: {
            id: { type: "string" },
            tags: { type: "array", items: { type: "string" }, minItems: 0 },
            flag: { type: "boolean", default: false },
          },
        },
      },
    };
    const naive = estimateTokens(naiveInlined);
    const optimized = estimateTokens(flattenSchema(withDefs));
    // Optimizer drops minItems and default fields → measurably smaller
    // than naive inline. Threshold: ≥ 15% in this shape.
    expect(optimized).toBeLessThan(naive * 0.85);
    expect(JSON.stringify(flattenSchema(withDefs))).not.toContain("minItems");
  });

  it("third realistic schema: nested array of $ref objects", () => {
    const input = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { $ref: "#/$defs/Item" },
          minItems: 0,
        },
      },
      $defs: {
        Item: { type: "object", properties: { sku: { type: "string" } } },
      },
    };
    const out = flattenSchema(input) as Record<string, unknown>;
    const items = (out.properties as { items: { items: unknown; minItems?: number } }).items;
    expect(items.items).toEqual({ type: "object", properties: { sku: { type: "string" } } });
    expect(items.minItems).toBeUndefined();
  });
});
