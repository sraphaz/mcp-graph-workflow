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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  handleConstitutionCreate,
  handleConstitutionUpdate,
  handleConstitutionList,
  handleConstitutionCheck,
} from "../mcp/tools/constitution.js";

describe("Constitution MCP tool handlers", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  const samplePrinciples = [
    { id: "p1", title: "Library-first", description: "Prefer libraries over custom", category: "architecture", weight: 0.8, enforceable: true },
    { id: "p2", title: "TDD mandatory", description: "Test before code", category: "process", weight: 1.0, enforceable: true },
    { id: "p3", title: "Simplicity", description: "KISS principle", category: "quality", weight: 0.7, enforceable: false },
  ];

  describe("handleConstitutionCreate", () => {
    it("should create constitution node and index principles", () => {
      // Arrange & Act
      const result = handleConstitutionCreate(store, {
        principles: samplePrinciples,
        scope: "global",
        rationale: "Project founding principles",
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.nodeId).toBeDefined();
      expect(result.principlesIndexed).toBe(3);
      expect(result.constitutionVersion).toBe("1.0.0");
    });

    it("should create node with type constitution", () => {
      // Arrange & Act
      const result = handleConstitutionCreate(store, {
        principles: samplePrinciples,
        scope: "global",
      });

      // Assert
      const node = store.getNodeById(result.nodeId);
      expect(node).toBeDefined();
      expect(node!.type).toBe("constitution");
      expect(node!.priority).toBe(1);
    });
  });

  describe("handleConstitutionUpdate", () => {
    it("should update principles and increment version", () => {
      // Arrange
      const created = handleConstitutionCreate(store, {
        principles: samplePrinciples,
        scope: "global",
      });

      const updatedPrinciples = [
        ...samplePrinciples,
        { id: "p4", title: "Security by design", description: "OWASP top 10", category: "security", weight: 0.9, enforceable: true },
      ];

      // Act
      const result = handleConstitutionUpdate(store, {
        nodeId: created.nodeId,
        principles: updatedPrinciples,
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.constitutionVersion).toBe("1.1.0");
      expect(result.principlesIndexed).toBe(4);
    });
  });

  describe("handleConstitutionList", () => {
    it("should return principles grouped by category", () => {
      // Arrange
      handleConstitutionCreate(store, {
        principles: samplePrinciples,
        scope: "global",
      });

      // Act
      const result = handleConstitutionList(store);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.totalPrinciples).toBe(3);
      expect(result.byCategory).toBeDefined();
      expect(result.byCategory.architecture).toHaveLength(1);
      expect(result.byCategory.process).toHaveLength(1);
      expect(result.byCategory.quality).toHaveLength(1);
    });

    it("should return empty when no constitution exists", () => {
      // Arrange & Act
      const result = handleConstitutionList(store);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.totalPrinciples).toBe(0);
    });
  });

  describe("handleConstitutionCheck", () => {
    it("should check a specific node against enforceable principles", () => {
      // Arrange
      handleConstitutionCreate(store, {
        principles: [
          { id: "p1", title: "No external services", description: "Must not use external APIs or services", category: "constraint", weight: 1.0, enforceable: true },
        ],
        scope: "global",
      });
      // Create a task node to check
      const db = store.getDb();
      const projectId = store.getActiveProject()!.id;
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO nodes (id, project_id, type, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run("test-node-1", projectId, "task", "Call external API", "Uses external REST API for data", "in_progress", 2, now, now);

      // Act
      const result = handleConstitutionCheck(store, { nodeId: "test-node-1" });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.nodesChecked).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].nodeId).toBe("test-node-1");
    });

    it("should check all in_progress and done nodes when no nodeId", () => {
      // Arrange
      handleConstitutionCreate(store, {
        principles: samplePrinciples,
        scope: "global",
      });
      const db = store.getDb();
      const projectId = store.getActiveProject()!.id;
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO nodes (id, project_id, type, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run("node-ip-1", projectId, "task", "Task A", "Some task", "in_progress", 2, now, now);
      db.prepare(
        "INSERT INTO nodes (id, project_id, type, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run("node-done-1", projectId, "task", "Task B", "Another task", "done", 2, now, now);
      db.prepare(
        "INSERT INTO nodes (id, project_id, type, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run("node-backlog-1", projectId, "task", "Task C", "Backlog task", "backlog", 3, now, now);

      // Act
      const result = handleConstitutionCheck(store, {});

      // Assert
      expect(result.ok).toBe(true);
      expect(result.nodesChecked).toBe(2); // only in_progress + done
    });
  });
});
