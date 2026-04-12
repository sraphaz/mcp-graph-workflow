import { describe, it, expect } from "vitest";
import {
  generateSpecDocument,
  validateSpecDocument,
} from "../core/spec-templates/spec-template-engine.js";
import { getSpecTemplate } from "../core/spec-templates/built-in-spec-templates.js";

describe("Spec template engine", () => {
  describe("generateSpecDocument", () => {
    it("should generate markdown from prd-template with variable substitution", () => {
      // Arrange
      const template = getSpecTemplate("prd-template")!;
      const variables = { projectName: "MyApp", targetUsers: "developers" };

      // Act
      const markdown = generateSpecDocument(template, variables);

      // Assert
      expect(markdown).toContain("MyApp");
      expect(markdown).not.toContain("{{projectName}}");
    });

    it("should include all required sections as headings", () => {
      // Arrange
      const template = getSpecTemplate("prd-template")!;

      // Act
      const markdown = generateSpecDocument(template, { projectName: "Test" });

      // Assert
      expect(markdown).toContain("## Vision");
      expect(markdown).toContain("## User Stories");
      expect(markdown).toContain("## Constraints");
      expect(markdown).toContain("## Acceptance Criteria");
      expect(markdown).toContain("## Risks");
    });

    it("should append constitution principles when template.constitution is true", () => {
      // Arrange
      const template = getSpecTemplate("prd-template")!;
      const principles = [
        { id: "p1", title: "TDD mandatory", description: "Test before code" },
        { id: "p2", title: "No external infra", description: "SQLite only" },
      ];

      // Act
      const markdown = generateSpecDocument(template, { projectName: "Test" }, principles);

      // Assert
      expect(markdown).toContain("## Constitution Principles");
      expect(markdown).toContain("TDD mandatory");
      expect(markdown).toContain("No external infra");
    });

    it("should NOT append constitution when template.constitution is false", () => {
      // Arrange
      const template = getSpecTemplate("task-breakdown-template")!;
      const principles = [{ id: "p1", title: "TDD", description: "Test first" }];

      // Act
      const markdown = generateSpecDocument(template, { projectName: "Test" }, principles);

      // Assert
      expect(markdown).not.toContain("## Constitution Principles");
    });

    it("should generate parser-compatible markdown with ## headings for sections", () => {
      // Arrange
      const template = getSpecTemplate("prd-template")!;

      // Act
      const markdown = generateSpecDocument(template, { projectName: "Test" });

      // Assert — sections use ## (level 2) which parser maps to epics/blocks
      const h2Count = (markdown.match(/^## /gm) ?? []).length;
      expect(h2Count).toBeGreaterThanOrEqual(5);
    });
  });

  describe("validateSpecDocument", () => {
    it("should pass when all required sections present", () => {
      // Arrange
      const template = getSpecTemplate("prd-template")!;
      const content = [
        "# PRD: Test",
        "## Vision",
        "The project vision.",
        "## User Stories",
        "As a user...",
        "## Constraints",
        "Must use SQLite only. No external services. Local first architecture always.",
        "## Acceptance Criteria",
        "GIVEN x WHEN y THEN z",
        "## Risks",
        "Risk: performance. Probability: Medium.",
      ].join("\n");

      // Act
      const result = validateSpecDocument(content, template);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("should report missing required sections", () => {
      // Arrange
      const template = getSpecTemplate("prd-template")!;
      const content = [
        "# PRD: Test",
        "## Vision",
        "The project vision.",
      ].join("\n");

      // Act
      const result = validateSpecDocument(content, template);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain("User Stories");
    });

    it("should warn on validation rule failure (minLength)", () => {
      // Arrange
      const template = getSpecTemplate("prd-template")!;
      const content = [
        "# PRD: Test",
        "## Vision",
        "Vision here.",
        "## User Stories",
        "Stories.",
        "## Constraints",
        "Short.", // minLength:50 rule on constraints
        "## Acceptance Criteria",
        "AC here.",
        "## Risks",
        "Risks here.",
      ].join("\n");

      // Act
      const result = validateSpecDocument(content, template);

      // Assert
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w: string) => w.includes("Constraints") && w.includes("minLength"))).toBe(true);
    });
  });
});
