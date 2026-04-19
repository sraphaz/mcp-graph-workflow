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
  getEffectiveStrictness,
  getEffectivePhases,
  getEffectiveDodChecks,
} from "../core/presets/preset-gate-adapter.js";

describe("Preset gate adapter", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  describe("getEffectiveStrictness", () => {
    it("should return project setting when no preset active (backward compatible)", () => {
      // Arrange
      store.setProjectSetting("lifecycle_strictness_mode", "advisory");

      // Act
      const result = getEffectiveStrictness(store);

      // Assert
      expect(result).toBe("advisory");
    });

    it("should return preset strictness when preset is active", () => {
      // Arrange
      store.setProjectSetting("active_preset", "strict-tdd");

      // Act
      const result = getEffectiveStrictness(store);

      // Assert
      expect(result).toBe("strict");
    });

    it("should let project setting override preset strictness", () => {
      // Arrange
      store.setProjectSetting("active_preset", "strict-tdd");
      store.setProjectSetting("lifecycle_strictness_mode", "advisory");

      // Act
      const result = getEffectiveStrictness(store);

      // Assert
      expect(result).toBe("advisory"); // project override wins
    });
  });

  describe("getEffectivePhases", () => {
    it("should return all 9 phases when no preset active", () => {
      // Arrange & Act
      const phases = getEffectivePhases(store);

      // Assert
      expect(phases).toHaveLength(9);
      expect(phases).toContain("DESIGN");
    });

    it("should skip DESIGN when agile-light preset active", () => {
      // Arrange
      store.setProjectSetting("active_preset", "agile-light");

      // Act
      const phases = getEffectivePhases(store);

      // Assert
      expect(phases).not.toContain("DESIGN");
      expect(phases).toContain("IMPLEMENT");
    });
  });

  describe("getEffectiveDodChecks", () => {
    it("should return empty when no preset active", () => {
      // Arrange & Act
      const checks = getEffectiveDodChecks(store);

      // Assert
      expect(checks).toEqual({});
    });

    it("should return preset DoD checks when preset active", () => {
      // Arrange
      store.setProjectSetting("active_preset", "enterprise");

      // Act
      const checks = getEffectiveDodChecks(store);

      // Assert
      expect(checks.constitution_check).toBe(true);
      expect(checks.has_acceptance_criteria).toBe(true);
    });
  });
});
