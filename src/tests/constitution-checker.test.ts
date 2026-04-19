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
import { ConstitutionChecker } from "../core/constitution/constitution-checker.js";
import type { GraphEventType } from "../core/events/event-types.js";

describe("ConstitutionChecker", () => {
  const principles = [
    { id: "p1", title: "No external infra", description: "Must not use external APIs or services", category: "constraint", weight: 1.0, enforceable: true },
    { id: "p2", title: "TDD mandatory", description: "Test before code always", category: "process", weight: 1.0, enforceable: true },
    { id: "p3", title: "Simplicity", description: "Keep it simple", category: "quality", weight: 0.7, enforceable: false },
  ];

  describe("checkNode", () => {
    it("should detect violation when node matches enforceable principle keywords", () => {
      // Arrange
      const checker = new ConstitutionChecker(principles);
      const node = {
        id: "n1",
        title: "Call external API",
        description: "Uses external REST API service for data fetching",
      };

      // Act
      const result = checker.checkNode(node);

      // Assert
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].principleId).toBe("p1");
      expect(result.passRate).toBeLessThan(100);
    });

    it("should pass when node does not match any principle keywords", () => {
      // Arrange
      const checker = new ConstitutionChecker(principles);
      const node = {
        id: "n2",
        title: "Add SQLite migration",
        description: "Create new table for local storage",
      };

      // Act
      const result = checker.checkNode(node);

      // Assert
      expect(result.violations).toHaveLength(0);
      expect(result.passRate).toBe(100);
    });

    it("should only check enforceable principles", () => {
      // Arrange
      const checker = new ConstitutionChecker(principles);
      const node = {
        id: "n3",
        title: "Complex feature",
        description: "A simple local implementation",
      };

      // Act
      const result = checker.checkNode(node);

      // Assert
      expect(result.principlesChecked).toBe(2); // only p1 and p2 are enforceable
    });
  });

  describe("checkNodes (batch)", () => {
    it("should check multiple nodes and return aggregate results", () => {
      // Arrange
      const checker = new ConstitutionChecker(principles);
      const nodes = [
        { id: "n1", title: "Local store", description: "SQLite storage" },
        { id: "n2", title: "External API call", description: "Calls external service" },
      ];

      // Act
      const results = checker.checkNodes(nodes);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].violations).toHaveLength(0); // n1 clean
      expect(results[1].violations.length).toBeGreaterThan(0); // n2 has violation
    });
  });
});

describe("Constitution event types", () => {
  it("should include constitution:created in GraphEventType", () => {
    // This verifies the type exists at compile time
    const eventType: GraphEventType = "constitution:created";
    expect(eventType).toBe("constitution:created");
  });

  it("should include constitution:updated in GraphEventType", () => {
    const eventType: GraphEventType = "constitution:updated";
    expect(eventType).toBe("constitution:updated");
  });

  it("should include constitution:check_completed in GraphEventType", () => {
    const eventType: GraphEventType = "constitution:check_completed";
    expect(eventType).toBe("constitution:check_completed");
  });
});
