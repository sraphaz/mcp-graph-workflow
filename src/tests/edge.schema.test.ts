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
import { GraphEdgeSchema, RelationTypeSchema } from "../schemas/edge.schema.js";

describe("RelationTypeSchema", () => {
  it("should accept all canonical relation types", () => {
    const types = [
      "parent_of",
      "child_of",
      "depends_on",
      "blocks",
      "related_to",
      "priority_over",
      "implements",
      "derived_from",
      "provides",
      "consumes",
      "requires_asset",
      "decomposed_into",
    ];
    for (const t of types) {
      expect(RelationTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it("should reject unknown relation types", () => {
    expect(RelationTypeSchema.safeParse("invented_relation").success).toBe(false);
    expect(RelationTypeSchema.safeParse("").success).toBe(false);
  });
});

describe("GraphEdgeSchema", () => {
  const baseEdge = {
    id: "e1",
    from: "n1",
    to: "n2",
    relationType: "depends_on" as const,
    createdAt: "2026-04-26T12:00:00.000Z",
  };

  it("should accept the minimal valid edge shape", () => {
    expect(GraphEdgeSchema.safeParse(baseEdge).success).toBe(true);
  });

  it("should accept optional weight in [0, 1]", () => {
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, weight: 0.7 }).success).toBe(true);
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, weight: 0 }).success).toBe(true);
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, weight: 1 }).success).toBe(true);
  });

  it("should reject weights outside [0, 1]", () => {
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, weight: -0.1 }).success).toBe(false);
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, weight: 1.5 }).success).toBe(false);
  });

  it("should reject missing required fields", () => {
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, from: undefined }).success).toBe(false);
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, to: undefined }).success).toBe(false);
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, createdAt: undefined }).success).toBe(false);
  });

  it("should reject id/from/to over the 100-char cap", () => {
    const huge = "x".repeat(150);
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, id: huge }).success).toBe(false);
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, from: huge }).success).toBe(false);
    expect(GraphEdgeSchema.safeParse({ ...baseEdge, to: huge }).success).toBe(false);
  });

  it("should accept arbitrary metadata records", () => {
    const result = GraphEdgeSchema.safeParse({
      ...baseEdge,
      metadata: { source: "test", inferred: true, confidence: 0.95 },
    });
    expect(result.success).toBe(true);
  });
});
