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

/**
 * TDD tests for task templates feature.
 * manage_skill(action: "create_template") and manage_skill(action: "list_templates")
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  createTaskTemplate,
  listTaskTemplates,
  getTaskTemplateByName,
} from "../core/skills/template-store.js";

describe("Task Templates", () => {
  let store: SqliteStore;
  let db: ReturnType<SqliteStore["getDb"]>;
  let projectId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Template Test");
    db = store.getDb();
    projectId = store.getProject()!.id;
  });

  afterEach(() => {
    store.close();
  });

  describe("createTaskTemplate", () => {
    it("should create a template with name, description, and subtasks", () => {
      const template = createTaskTemplate(db, projectId, {
        name: "backend_ui_task",
        description: "Standard backend + UI task pattern",
        subtasks: [
          { title: "Implement backend logic", type: "subtask" },
          { title: "Create UI components", type: "subtask" },
          { title: "Write integration tests", type: "subtask", acceptanceCriteria: ["All tests pass"] },
        ],
      });

      expect(template.id).toBeTruthy();
      expect(template.name).toBe("backend_ui_task");
      expect(template.description).toBe("Standard backend + UI task pattern");
      expect(template.subtasks).toHaveLength(3);
      expect(template.subtasks[2].acceptanceCriteria).toEqual(["All tests pass"]);
      expect(template.createdAt).toBeTruthy();
    });

    it("should reject duplicate template names", () => {
      createTaskTemplate(db, projectId, {
        name: "duplicate_template",
        description: "First",
        subtasks: [{ title: "Task 1", type: "subtask" }],
      });

      expect(() =>
        createTaskTemplate(db, projectId, {
          name: "duplicate_template",
          description: "Second",
          subtasks: [{ title: "Task 2", type: "subtask" }],
        }),
      ).toThrow(/already exists/);
    });

    it("should accept subtasks with optional fields", () => {
      const template = createTaskTemplate(db, projectId, {
        name: "minimal_template",
        description: "Minimal",
        subtasks: [
          { title: "Just a title", type: "task" },
          {
            title: "Full subtask",
            type: "subtask",
            acceptanceCriteria: ["AC1", "AC2"],
            tags: ["backend"],
            xpSize: "S",
          },
        ],
      });

      expect(template.subtasks[0].acceptanceCriteria).toBeUndefined();
      expect(template.subtasks[1].tags).toEqual(["backend"]);
      expect(template.subtasks[1].xpSize).toBe("S");
    });
  });

  describe("listTaskTemplates", () => {
    it("should return all templates for a project", () => {
      createTaskTemplate(db, projectId, {
        name: "template_1",
        description: "First",
        subtasks: [{ title: "T1", type: "subtask" }],
      });
      createTaskTemplate(db, projectId, {
        name: "template_2",
        description: "Second",
        subtasks: [{ title: "T2", type: "subtask" }],
      });

      const templates = listTaskTemplates(db, projectId);
      expect(templates).toHaveLength(2);
      expect(templates.map((t) => t.name)).toContain("template_1");
      expect(templates.map((t) => t.name)).toContain("template_2");
    });

    it("should return empty array when no templates exist", () => {
      const templates = listTaskTemplates(db, projectId);
      expect(templates).toEqual([]);
    });
  });

  describe("getTaskTemplateByName", () => {
    it("should find template by name", () => {
      createTaskTemplate(db, projectId, {
        name: "findable",
        description: "Find me",
        subtasks: [{ title: "Sub", type: "subtask" }],
      });

      const found = getTaskTemplateByName(db, projectId, "findable");
      expect(found).toBeDefined();
      expect(found!.name).toBe("findable");
      expect(found!.subtasks).toHaveLength(1);
    });

    it("should return undefined for non-existent template", () => {
      const found = getTaskTemplateByName(db, projectId, "nope");
      expect(found).toBeUndefined();
    });
  });
});
