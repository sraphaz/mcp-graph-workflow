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
  handleSpecGenerate,
  handleSpecValidate,
  handleSpecListTemplates,
} from "../mcp/tools/spec.js";

describe("Spec MCP tool handlers", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  describe("handleSpecListTemplates", () => {
    it("should list all built-in templates", () => {
      // Act
      const result = handleSpecListTemplates();

      // Assert
      expect(result.ok).toBe(true);
      expect(result.templates.length).toBeGreaterThanOrEqual(4);
      const names = result.templates.map((t: { name: string }) => t.name);
      expect(names).toContain("prd-template");
      expect(names).toContain("architecture-template");
      expect(names).toContain("task-breakdown-template");
      expect(names).toContain("implementation-spec-template");
    });

    it("should include phase and section count for each template", () => {
      const result = handleSpecListTemplates();
      const prd = result.templates.find((t: { name: string }) => t.name === "prd-template");
      expect(prd.phase).toBe("ANALYZE");
      expect(prd.sectionCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe("handleSpecGenerate", () => {
    it("should generate markdown from prd-template", () => {
      // Act
      const result = handleSpecGenerate(store, {
        templateName: "prd-template",
        variables: { projectName: "TestProject" },
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.markdown).toContain("TestProject");
      expect(result.markdown).toContain("## Vision");
      expect(result.markdown).toContain("## Risks");
    });

    it("should return error for unknown template", () => {
      const result = handleSpecGenerate(store, {
        templateName: "nonexistent",
        variables: {},
      });
      expect(result.ok).toBe(false);
    });

    it("should index generated document in knowledge store", () => {
      // Act
      const result = handleSpecGenerate(store, {
        templateName: "prd-template",
        variables: { projectName: "IndexTest" },
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.knowledgeIndexed).toBe(true);
    });
  });

  describe("handleSpecValidate", () => {
    it("should validate content against template", () => {
      // Arrange
      const content = [
        "# PRD: Test",
        "## Vision", "Vision statement here.",
        "## User Stories", "As a user...",
        "## Constraints", "Must use SQLite. No external services. Local-first architecture required.",
        "## Acceptance Criteria", "GIVEN x WHEN y THEN z",
        "## Risks", "Risk identified.",
      ].join("\n");

      // Act
      const result = handleSpecValidate({
        content,
        templateName: "prd-template",
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("should report missing sections", () => {
      const result = handleSpecValidate({
        content: "# PRD\n## Vision\nHello",
        templateName: "prd-template",
      });

      expect(result.ok).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });
});
