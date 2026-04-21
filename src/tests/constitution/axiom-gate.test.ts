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
 * Task 2.2: Gate bloqueante de axioma em strict — node_d2bd233bd83c
 *
 * AC1: strict + orphan principle → gate blocks with list of orphans
 * AC2: all principles linked → gate releases + records snapshot
 * AC3: advisory + orphan → warning emitted but transition proceeds
 */

import { describe, it, expect } from "vitest";
import type { AxiomLink } from "../../schemas/axiom-link.schema.js";
import { checkAxiomGate, type AxiomGateContext } from "../../core/constitution/axiom-gate.js";

function makeLink(principleId: string, revoked = false): AxiomLink {
  return {
    id: `link_${principleId}`,
    constitutionPrincipleId: principleId,
    acceptanceCriteriaIds: [`ac_${principleId}`],
    provenanceReceiptId: `prov_${principleId}`,
    timestamp: "2026-01-01T00:00:00Z",
    revoked,
  };
}

// ── AC1: strict mode + orphan ─────────────────────────────────────
describe("checkAxiomGate — AC1: strict blocks orphans", () => {
  it("should block when an active principle has no axiom_link (strict)", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1", "p2"],
      axiomLinks: [makeLink("p1")],
      mode: "strict",
    };
    const result = checkAxiomGate(ctx);
    expect(result.blocked).toBe(true);
  });

  it("should list the orphan principle IDs in the result", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1", "p2", "p3"],
      axiomLinks: [makeLink("p1")],
      mode: "strict",
    };
    const result = checkAxiomGate(ctx);
    expect(result.orphanPrincipleIds).toContain("p2");
    expect(result.orphanPrincipleIds).toContain("p3");
    expect(result.orphanPrincipleIds).not.toContain("p1");
  });

  it("should treat a revoked axiom_link as orphan in strict mode", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1"],
      axiomLinks: [makeLink("p1", true)], // revoked
      mode: "strict",
    };
    const result = checkAxiomGate(ctx);
    expect(result.blocked).toBe(true);
    expect(result.orphanPrincipleIds).toContain("p1");
  });

  it("should report mode as strict in the result", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1"],
      axiomLinks: [],
      mode: "strict",
    };
    const result = checkAxiomGate(ctx);
    expect(result.mode).toBe("strict");
  });
});

// ── AC2: all linked → release + snapshot ─────────────────────────
describe("checkAxiomGate — AC2: all linked releases gate", () => {
  it("should not block when all principles have valid axiom_links", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1", "p2"],
      axiomLinks: [makeLink("p1"), makeLink("p2")],
      mode: "strict",
    };
    const result = checkAxiomGate(ctx);
    expect(result.blocked).toBe(false);
  });

  it("should return empty orphanPrincipleIds when all linked", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1", "p2"],
      axiomLinks: [makeLink("p1"), makeLink("p2")],
      mode: "strict",
    };
    const result = checkAxiomGate(ctx);
    expect(result.orphanPrincipleIds).toHaveLength(0);
  });

  it("should return a snapshotToken when gate releases", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1"],
      axiomLinks: [makeLink("p1")],
      mode: "strict",
    };
    const result = checkAxiomGate(ctx);
    expect(result.snapshotToken).toBeDefined();
    expect(typeof result.snapshotToken).toBe("string");
    expect((result.snapshotToken as string).length).toBeGreaterThan(0);
  });

  it("should not return snapshotToken when blocked", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1", "p2"],
      axiomLinks: [makeLink("p1")],
      mode: "strict",
    };
    const result = checkAxiomGate(ctx);
    expect(result.snapshotToken).toBeUndefined();
  });
});

// ── AC3: advisory mode — warn but pass ───────────────────────────
describe("checkAxiomGate — AC3: advisory warns but proceeds", () => {
  it("should not block in advisory mode even with orphan principles", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1", "p2"],
      axiomLinks: [makeLink("p1")],
      mode: "advisory",
    };
    const result = checkAxiomGate(ctx);
    expect(result.blocked).toBe(false);
  });

  it("should emit warnings listing orphans in advisory mode", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1", "p2"],
      axiomLinks: [makeLink("p1")],
      mode: "advisory",
    };
    const result = checkAxiomGate(ctx);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("p2"))).toBe(true);
  });

  it("should pass with no warnings when all linked in advisory mode", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1"],
      axiomLinks: [makeLink("p1")],
      mode: "advisory",
    };
    const result = checkAxiomGate(ctx);
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it("should never block in off mode regardless of orphans", () => {
    const ctx: AxiomGateContext = {
      activePrincipleIds: ["p1", "p2"],
      axiomLinks: [],
      mode: "off",
    };
    const result = checkAxiomGate(ctx);
    expect(result.blocked).toBe(false);
  });
});
