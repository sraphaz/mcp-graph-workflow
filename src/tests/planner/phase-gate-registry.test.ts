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
  PHASE_TRANSITION_REGISTRY,
  LIFECYCLE_PHASES,
  validateRegistryCompleteness,
  getRegistryForDashboard,
  checkRegistryTransition,
} from "../../core/planner/phase-gate-registry.js";
import type { LifecyclePhase } from "../../core/planner/lifecycle-phase.js";

// ── AC 1: lint valida que todas transicoes tem gate ────────────────────────

describe("validateRegistryCompleteness (AC 1 — lint)", () => {
  it("should report complete when all declared transitions have gate entries", () => {
    const result = validateRegistryCompleteness();

    expect(result.complete).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("should export LIFECYCLE_PHASES with all 9 phases", () => {
    expect(LIFECYCLE_PHASES).toHaveLength(9);
    expect(LIFECYCLE_PHASES).toContain("ANALYZE");
    expect(LIFECYCLE_PHASES).toContain("IMPLEMENT");
    expect(LIFECYCLE_PHASES).toContain("LISTENING");
  });

  it("should have an entry for every canonical forward transition", () => {
    const forwardPairs: [string, string][] = [
      ["ANALYZE", "DESIGN"],
      ["DESIGN", "PLAN"],
      ["PLAN", "IMPLEMENT"],
      ["IMPLEMENT", "VALIDATE"],
      ["VALIDATE", "REVIEW"],
      ["REVIEW", "HANDOFF"],
      ["HANDOFF", "DEPLOY"],
      ["HANDOFF", "LISTENING"],
      ["DEPLOY", "LISTENING"],
    ];

    for (const [from, to] of forwardPairs) {
      const key = `${from}_to_${to}` as keyof typeof PHASE_TRANSITION_REGISTRY;
      expect(PHASE_TRANSITION_REGISTRY[key]).toBeDefined();
    }
  });

  it("should have gateMode set (not undefined) for all registry entries", () => {
    for (const entry of Object.values(PHASE_TRANSITION_REGISTRY)) {
      expect(["required", "advisory", "ungated"]).toContain(entry.gateMode);
    }
  });
});

// ── AC 2: gate ausente em strict → erro acionavel ────────────────────────

describe("checkRegistryTransition (AC 2 — strict error)", () => {
  it("should allow a known gated transition when gate exists", () => {
    const result = checkRegistryTransition("ANALYZE", "DESIGN", "strict");

    expect(result.registered).toBe(true);
  });

  it("should block an unknown transition in strict mode with actionable message", () => {
    const result = checkRegistryTransition("LISTENING", "IMPLEMENT" as LifecyclePhase, "strict");

    expect(result.registered).toBe(false);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("phase-gate-registry");
    expect(result.message).toContain("LISTENING");
  });

  it("should allow an unknown transition in advisory mode with a warning", () => {
    const result = checkRegistryTransition("LISTENING", "IMPLEMENT" as LifecyclePhase, "advisory");

    expect(result.registered).toBe(false);
    expect(result.allowed).toBe(true);
    expect(result.message).toBeDefined();
  });

  it("should return gateMode for registered transitions", () => {
    const result = checkRegistryTransition("ANALYZE", "DESIGN", "strict");

    expect(result.gateMode).toBeDefined();
    expect(["required", "advisory", "ungated"]).toContain(result.gateMode);
  });

  it("should return analyzeModes for transitions that require them", () => {
    const result = checkRegistryTransition("DESIGN", "PLAN", "strict");

    expect(Array.isArray(result.analyzeModes)).toBe(true);
  });
});

// ── AC 3: dashboard consulta registro ────────────────────────────────────

describe("getRegistryForDashboard (AC 3 — dashboard query)", () => {
  it("should return an array of all registry entries", () => {
    const entries = getRegistryForDashboard();

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("should include from, to, gateMode, and description for every entry", () => {
    const entries = getRegistryForDashboard();

    for (const entry of entries) {
      expect(entry.from).toBeDefined();
      expect(entry.to).toBeDefined();
      expect(entry.gateMode).toBeDefined();
      expect(entry.description).toBeDefined();
      expect(typeof entry.description).toBe("string");
    }
  });

  it("should include all canonical forward transitions", () => {
    const entries = getRegistryForDashboard();
    const keys = entries.map(e => `${e.from}_to_${e.to}`);

    expect(keys).toContain("ANALYZE_to_DESIGN");
    expect(keys).toContain("IMPLEMENT_to_VALIDATE");
    expect(keys).toContain("DEPLOY_to_LISTENING");
  });

  it("should include analyzeModes field for each entry", () => {
    const entries = getRegistryForDashboard();

    for (const entry of entries) {
      expect(Array.isArray(entry.analyzeModes)).toBe(true);
    }
  });
});

// ── Structural invariants ─────────────────────────────────────────────────

describe("PHASE_TRANSITION_REGISTRY structural invariants", () => {
  it("should have consistent from/to fields matching the key", () => {
    for (const [key, entry] of Object.entries(PHASE_TRANSITION_REGISTRY)) {
      const expectedKey = `${entry.from}_to_${entry.to}`;
      expect(key).toBe(expectedKey);
    }
  });

  it("should not have self-transitions", () => {
    for (const entry of Object.values(PHASE_TRANSITION_REGISTRY)) {
      expect(entry.from).not.toBe(entry.to);
    }
  });
});
