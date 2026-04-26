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
  GraphIndexesSchema,
  GraphProjectSchema,
  GraphMetaSchema,
  GraphDocumentSchema,
} from "../schemas/graph.schema.js";

const validProject = {
  id: "proj-1",
  name: "Test",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-26T12:00:00.000Z",
};

describe("GraphProjectSchema", () => {
  it("should accept the minimal valid project", () => {
    expect(GraphProjectSchema.safeParse(validProject).success).toBe(true);
  });

  it("should accept the optional fsPath", () => {
    const result = GraphProjectSchema.safeParse({
      ...validProject,
      fsPath: "/Users/me/project",
    });
    expect(result.success).toBe(true);
  });

  it("should reject when name exceeds 500 chars", () => {
    const result = GraphProjectSchema.safeParse({
      ...validProject,
      name: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("GraphIndexesSchema", () => {
  it("should accept empty index records", () => {
    const result = GraphIndexesSchema.safeParse({
      byId: {},
      childrenByParent: {},
      incomingByNode: {},
      outgoingByNode: {},
    });
    expect(result.success).toBe(true);
  });

  it("should accept populated index records", () => {
    const result = GraphIndexesSchema.safeParse({
      byId: { "n1": 0, "n2": 1 },
      childrenByParent: { "n1": ["n2"] },
      incomingByNode: { "n2": ["n1"] },
      outgoingByNode: { "n1": ["n2"] },
    });
    expect(result.success).toBe(true);
  });
});

describe("GraphMetaSchema", () => {
  it("should accept null lastImport", () => {
    const result = GraphMetaSchema.safeParse({
      sourceFiles: [],
      lastImport: null,
    });
    expect(result.success).toBe(true);
  });

  it("should accept ISO string lastImport", () => {
    const result = GraphMetaSchema.safeParse({
      sourceFiles: ["/a.md", "/b.md"],
      lastImport: "2026-04-26T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("should reject when lastImport is undefined (must be string|null)", () => {
    const result = GraphMetaSchema.safeParse({
      sourceFiles: [],
      lastImport: undefined,
    });
    expect(result.success).toBe(false);
  });
});

describe("GraphDocumentSchema", () => {
  it("should accept the minimal empty graph document", () => {
    const result = GraphDocumentSchema.safeParse({
      version: "1.0.0",
      project: validProject,
      nodes: [],
      edges: [],
      indexes: {
        byId: {},
        childrenByParent: {},
        incomingByNode: {},
        outgoingByNode: {},
      },
      meta: {
        sourceFiles: [],
        lastImport: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject when required top-level fields are missing", () => {
    expect(GraphDocumentSchema.safeParse({}).success).toBe(false);
    expect(
      GraphDocumentSchema.safeParse({ version: "1.0.0", project: validProject }).success,
    ).toBe(false);
  });
});
