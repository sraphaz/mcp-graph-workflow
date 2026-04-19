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

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { SpecStore } from "../core/spec-evolution/spec-store.js";
import {
  detectSpecImpact,
  syncSpecToGraph,
} from "../core/spec-evolution/sync-engine.js";

describe("Spec sync engine", () => {
  let db: Database.Database;
  let specStore: SpecStore;
  const projectId = "test-project";

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
    specStore = new SpecStore(db);
  });

  describe("detectSpecImpact", () => {
    it("should return affected spec sections when linked nodes change", () => {
      // Arrange
      const spec = specStore.register({ projectId, name: "auth-spec", templateName: "prd", content: "# Auth" });
      specStore.linkNode(spec.id, "task-1", "Auth Module", "derived_from");
      specStore.linkNode(spec.id, "task-2", "Login Flow", "implements");

      // Act
      const impacts = detectSpecImpact(specStore, ["task-1"]);

      // Assert
      expect(impacts).toHaveLength(1);
      expect(impacts[0].specId).toBe(spec.id);
      expect(impacts[0].sectionTitle).toBe("Auth Module");
      expect(impacts[0].nodeId).toBe("task-1");
    });

    it("should return empty when no linked nodes affected", () => {
      // Arrange
      const spec = specStore.register({ projectId, name: "spec-a", templateName: "prd", content: "test" });
      specStore.linkNode(spec.id, "node-99", "Section", "derived_from");

      // Act
      const impacts = detectSpecImpact(specStore, ["unrelated-node"]);

      // Assert
      expect(impacts).toHaveLength(0);
    });

    it("should detect impacts across multiple specs", () => {
      // Arrange
      const spec1 = specStore.register({ projectId, name: "spec-1", templateName: "prd", content: "s1" });
      const spec2 = specStore.register({ projectId, name: "spec-2", templateName: "arch", content: "s2" });
      specStore.linkNode(spec1.id, "shared-node", "Vision", "derived_from");
      specStore.linkNode(spec2.id, "shared-node", "Components", "implements");

      // Act
      const impacts = detectSpecImpact(specStore, ["shared-node"]);

      // Assert
      expect(impacts).toHaveLength(2);
    });
  });

  describe("syncSpecToGraph", () => {
    it("should detect no changes when content_hash is the same", () => {
      // Arrange
      const spec = specStore.register({ projectId, name: "unchanged", templateName: "prd", content: "# Same content" });

      // Act
      const result = syncSpecToGraph(specStore, spec.id, "# Same content");

      // Assert
      expect(result.changed).toBe(false);
      expect(result.message).toContain("unchanged");
    });

    it("should update spec version when content changes", () => {
      // Arrange
      const spec = specStore.register({ projectId, name: "evolving", templateName: "prd", content: "# V1" });

      // Act
      const result = syncSpecToGraph(specStore, spec.id, "# V2 with new sections");

      // Assert
      expect(result.changed).toBe(true);
      expect(result.newVersion).toBe(2);

      const updated = specStore.get(spec.id);
      expect(updated?.version).toBe(2);
    });

    it("should return error for nonexistent spec", () => {
      // Act
      const result = syncSpecToGraph(specStore, "nonexistent-id", "content");

      // Assert
      expect(result.changed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
