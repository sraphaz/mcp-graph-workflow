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
import { NodeTypeSchema, GraphNodeSchema } from "../schemas/node.schema.js";
import type { NodeType, GraphNode } from "../core/graph/graph-types.js";

describe("Constitution node type", () => {
  describe("NodeTypeSchema validation", () => {
    it("should accept 'constitution' as a valid node type", () => {
      // Arrange
      const type = "constitution";

      // Act
      const result = NodeTypeSchema.safeParse(type);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("constitution");
      }
    });

    it("should reject invalid node types", () => {
      // Arrange
      const type = "invalid_type";

      // Act
      const result = NodeTypeSchema.safeParse(type);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("GraphNodeSchema with constitution type", () => {
    it("should validate a constitution node with principles metadata", () => {
      // Arrange
      const constitutionNode = {
        id: "test-constitution-1",
        type: "constitution",
        title: "Project Constitution",
        description: "Governing principles for the project",
        status: "backlog",
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          constitutionVersion: "1.0.0",
          scope: "global",
          principles: [
            {
              id: "p1",
              title: "Library-first design",
              description: "Prefer libraries over custom implementations",
              category: "architecture",
              weight: 0.8,
              enforceable: true,
            },
            {
              id: "p2",
              title: "TDD mandatory",
              description: "Test before code, always",
              category: "process",
              weight: 1.0,
              enforceable: true,
            },
          ],
        },
      };

      // Act
      const result = GraphNodeSchema.safeParse(constitutionNode);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("constitution");
        expect(result.data.metadata?.constitutionVersion).toBe("1.0.0");
        expect(result.data.metadata?.scope).toBe("global");
        const principles = result.data.metadata?.principles as Array<Record<string, unknown>>;
        expect(principles).toHaveLength(2);
        expect(principles[0].category).toBe("architecture");
        expect(principles[1].weight).toBe(1.0);
      }
    });

    it("should validate constitution node with semver version format", () => {
      // Arrange
      const node = {
        id: "test-constitution-2",
        type: "constitution",
        title: "Module Constitution",
        status: "backlog",
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          constitutionVersion: "2.1.0",
          scope: "module",
          principles: [],
        },
      };

      // Act
      const result = GraphNodeSchema.safeParse(node);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata?.constitutionVersion).toBe("2.1.0");
      }
    });
  });

  describe("TypeScript type compatibility", () => {
    it("should allow constitution as NodeType", () => {
      // Arrange & Act
      const nodeType: NodeType = "constitution";

      // Assert
      expect(nodeType).toBe("constitution");
    });

    it("should allow constitution in GraphNode interface", () => {
      // Arrange & Act
      const node: GraphNode = {
        id: "test-constitution-3",
        type: "constitution",
        title: "Test Constitution",
        status: "backlog",
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          constitutionVersion: "1.0.0",
          scope: "global",
          principles: [],
        },
      };

      // Assert
      expect(node.type).toBe("constitution");
      expect(node.metadata?.constitutionVersion).toBe("1.0.0");
    });
  });
});
