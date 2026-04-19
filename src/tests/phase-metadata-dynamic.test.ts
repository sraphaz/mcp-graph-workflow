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
  getPhaseBoost,
  getDynamicPhaseBoost,
  getSourceAffinity,
  getAdjacentPhases,
  PHASE_ORDER,
  PHASE_SOURCE_AFFINITY,
} from "../core/rag/phase-metadata.js";

describe("Phase Metadata — Dynamic Boosting", () => {
  describe("PHASE_ORDER", () => {
    it("should contain all 9 lifecycle phases in order", () => {
      expect(PHASE_ORDER).toHaveLength(9);
      expect(PHASE_ORDER[0]).toBe("ANALYZE");
      expect(PHASE_ORDER[3]).toBe("IMPLEMENT");
      expect(PHASE_ORDER[8]).toBe("LISTENING");
    });
  });

  describe("getAdjacentPhases", () => {
    it("should return prev and next for middle phases", () => {
      const { prev, next } = getAdjacentPhases("IMPLEMENT");
      expect(prev).toBe("PLAN");
      expect(next).toBe("VALIDATE");
    });

    it("should return null prev for first phase", () => {
      const { prev, next } = getAdjacentPhases("ANALYZE");
      expect(prev).toBeNull();
      expect(next).toBe("DESIGN");
    });

    it("should return null next for last phase", () => {
      const { prev, next } = getAdjacentPhases("LISTENING");
      expect(prev).toBe("DEPLOY");
      expect(next).toBeNull();
    });
  });

  describe("getSourceAffinity", () => {
    it("should boost code_context during IMPLEMENT phase", () => {
      const boost = getSourceAffinity("IMPLEMENT", "code_context");
      expect(boost).toBe(1.5);
    });

    it("should boost prd during ANALYZE phase", () => {
      const boost = getSourceAffinity("ANALYZE", "prd");
      expect(boost).toBe(1.5);
    });

    it("should boost docs during IMPLEMENT phase", () => {
      const boost = getSourceAffinity("IMPLEMENT", "docs");
      expect(boost).toBe(1.4);
    });

    it("should return neutral for unknown source types", () => {
      const boost = getSourceAffinity("IMPLEMENT", "unknown_type");
      expect(boost).toBe(1.0);
    });

    it("should return neutral for undefined source type", () => {
      const boost = getSourceAffinity("IMPLEMENT", undefined);
      expect(boost).toBe(1.0);
    });
  });

  describe("getDynamicPhaseBoost", () => {
    it("should combine phase and source affinity boosts", () => {
      // IMPLEMENT phase, IMPLEMENT doc, code_context source
      const boost = getDynamicPhaseBoost("IMPLEMENT", "IMPLEMENT", "code_context");

      // phaseBoost = 2.0, sourceBoost = 1.5
      // combined = sqrt(2.0 * 1.5) = sqrt(3.0) ≈ 1.732
      expect(boost).toBeGreaterThan(1.5);
      expect(boost).toBeLessThan(2.0);
    });

    it("should return neutral for unrelated phase and source", () => {
      const boost = getDynamicPhaseBoost("IMPLEMENT", undefined, undefined);
      // phaseBoost = 1.0, sourceBoost = 1.0 → sqrt(1.0) = 1.0
      expect(boost).toBe(1.0);
    });

    it("should be higher for matching phase+source than mismatched", () => {
      const matching = getDynamicPhaseBoost("IMPLEMENT", "IMPLEMENT", "code_context");
      const mismatched = getDynamicPhaseBoost("IMPLEMENT", "ANALYZE", "prd");

      expect(matching).toBeGreaterThan(mismatched);
    });

    it("should handle all lifecycle phases without errors", () => {
      for (const phase of PHASE_ORDER) {
        const boost = getDynamicPhaseBoost(phase, phase, "memory");
        expect(boost).toBeGreaterThan(0);
      }
    });
  });

  describe("Enhanced PHASE_BOOST_WEIGHTS", () => {
    it("should include adjacent phases for IMPLEMENT", () => {
      const implementBoost = getPhaseBoost("IMPLEMENT", "VALIDATE");
      expect(implementBoost).toBeGreaterThan(1.0);
    });

    it("should include adjacent phases for DEPLOY", () => {
      const deployBoost = getPhaseBoost("DEPLOY", "LISTENING");
      expect(deployBoost).toBeGreaterThan(1.0);
    });

    it("should include adjacent phases for ANALYZE", () => {
      const analyzeBoost = getPhaseBoost("ANALYZE", "DESIGN");
      expect(analyzeBoost).toBeGreaterThan(1.0);
    });
  });

  describe("PHASE_SOURCE_AFFINITY", () => {
    it("should define affinities for all 9 phases", () => {
      expect(Object.keys(PHASE_SOURCE_AFFINITY)).toHaveLength(9);
    });

    it("should have at least 2 source type affinities per phase", () => {
      for (const phase of PHASE_ORDER) {
        const affinities = PHASE_SOURCE_AFFINITY[phase];
        expect(Object.keys(affinities).length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
