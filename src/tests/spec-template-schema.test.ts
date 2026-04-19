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
import { SpecTemplateSchema } from "../schemas/spec-template.schema.js";
import {
  BUILT_IN_SPEC_TEMPLATES,
  getSpecTemplate,
} from "../core/spec-templates/built-in-spec-templates.js";
import type { SpecTemplate } from "../schemas/spec-template.schema.js";

describe("SpecTemplateSchema validation", () => {
  it("should validate a complete spec template", () => {
    // Arrange
    const template: SpecTemplate = {
      name: "test-template",
      phase: "ANALYZE",
      description: "A test template",
      sections: [
        {
          title: "Vision",
          description: "Project vision statement",
          required: true,
          placeholder: "Describe the vision...",
          outputNodeType: "epic",
        },
        {
          title: "Constraints",
          description: "Technical constraints",
          required: true,
          outputNodeType: "constraint",
          validationRules: ["minLength:100"],
        },
      ],
      variables: {
        projectName: { description: "Project name", type: "string", required: true },
        priority: { description: "Priority level", type: "select", required: false, options: ["high", "medium", "low"] },
      },
      constitution: true,
    };

    // Act
    const result = SpecTemplateSchema.safeParse(template);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should validate minimal template", () => {
    // Arrange
    const template = {
      name: "minimal",
      phase: "IMPLEMENT",
      description: "Minimal template",
      sections: [{ title: "Approach", description: "Implementation approach" }],
    };

    // Act
    const result = SpecTemplateSchema.safeParse(template);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should reject template with empty name", () => {
    const result = SpecTemplateSchema.safeParse({
      name: "", phase: "ANALYZE", description: "Bad", sections: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject template with invalid phase", () => {
    const result = SpecTemplateSchema.safeParse({
      name: "bad", phase: "INVALID", description: "Bad", sections: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Built-in spec templates", () => {
  it("should have 4 built-in templates", () => {
    expect(BUILT_IN_SPEC_TEMPLATES).toHaveLength(4);
  });

  it("should all validate against SpecTemplateSchema", () => {
    for (const template of BUILT_IN_SPEC_TEMPLATES) {
      const result = SpecTemplateSchema.safeParse(template);
      expect(result.success, `Template "${template.name}" failed validation`).toBe(true);
    }
  });

  describe("prd-template (ANALYZE)", () => {
    it("should have 5+ sections with outputNodeType mappings", () => {
      const tmpl = getSpecTemplate("prd-template");
      expect(tmpl).toBeDefined();
      expect(tmpl!.phase).toBe("ANALYZE");
      expect(tmpl!.sections.length).toBeGreaterThanOrEqual(5);

      const types = tmpl!.sections.map((s) => s.outputNodeType).filter(Boolean);
      expect(types).toContain("epic");
      expect(types).toContain("task");
      expect(types).toContain("constraint");
      expect(types).toContain("risk");
      expect(types).toContain("acceptance_criteria");
    });
  });

  describe("architecture-template (DESIGN)", () => {
    it("should include system_context, components, decisions, interfaces", () => {
      const tmpl = getSpecTemplate("architecture-template");
      expect(tmpl).toBeDefined();
      expect(tmpl!.phase).toBe("DESIGN");

      const titles = tmpl!.sections.map((s) => s.title.toLowerCase());
      expect(titles.some((t) => t.includes("context"))).toBe(true);
      expect(titles.some((t) => t.includes("component"))).toBe(true);
      expect(titles.some((t) => t.includes("decision"))).toBe(true);
      expect(titles.some((t) => t.includes("interface"))).toBe(true);
    });
  });

  describe("task-breakdown-template (PLAN)", () => {
    it("should include epics, tasks, dependencies, estimates", () => {
      const tmpl = getSpecTemplate("task-breakdown-template");
      expect(tmpl).toBeDefined();
      expect(tmpl!.phase).toBe("PLAN");

      const titles = tmpl!.sections.map((s) => s.title.toLowerCase());
      expect(titles.some((t) => t.includes("epic"))).toBe(true);
      expect(titles.some((t) => t.includes("task") || t.includes("decomposition"))).toBe(true);
      expect(titles.some((t) => t.includes("depend"))).toBe(true);
    });
  });

  describe("implementation-spec-template (IMPLEMENT)", () => {
    it("should include approach, files, tests, edge cases", () => {
      const tmpl = getSpecTemplate("implementation-spec-template");
      expect(tmpl).toBeDefined();
      expect(tmpl!.phase).toBe("IMPLEMENT");

      const titles = tmpl!.sections.map((s) => s.title.toLowerCase());
      expect(titles.some((t) => t.includes("approach"))).toBe(true);
      expect(titles.some((t) => t.includes("file") || t.includes("change"))).toBe(true);
      expect(titles.some((t) => t.includes("test"))).toBe(true);
      expect(titles.some((t) => t.includes("edge"))).toBe(true);
    });
  });

  describe("variables", () => {
    it("prd-template should have projectName variable", () => {
      const tmpl = getSpecTemplate("prd-template");
      expect(tmpl!.variables?.projectName).toBeDefined();
      expect(tmpl!.variables?.projectName.type).toBe("string");
      expect(tmpl!.variables?.projectName.required).toBe(true);
    });
  });
});
