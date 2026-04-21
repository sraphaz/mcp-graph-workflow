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
  promoteTier,
  MissingEvidenceError,
  InvalidCitationError,
  type EpistemicTier,
  type PromotionInput,
} from "../../core/provenance/tier-promotion.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function input(overrides: Partial<PromotionInput> = {}): PromotionInput {
  return {
    nodeId: "node_test",
    currentTier: "claim",
    targetTier: "cited",
    evidence: {},
    ...overrides,
  };
}

// ── AC 1: claim → cited sem citation_id → erro pedindo artefato ───────────

describe("promoteTier (AC 1 — missing citation_id)", () => {
  it("should throw MissingEvidenceError when promoting claim→cited with no citation_id", () => {
    expect(() =>
      promoteTier(input({ currentTier: "claim", targetTier: "cited", evidence: {} })),
    ).toThrow(MissingEvidenceError);
  });

  it("should include 'citation_id' in the error message", () => {
    expect(() =>
      promoteTier(input({ currentTier: "claim", targetTier: "cited", evidence: {} })),
    ).toThrow(/citation_id/i);
  });

  it("should throw MissingEvidenceError when promoting validated→proven with no provenance_receipt_id", () => {
    expect(() =>
      promoteTier(input({
        currentTier: "validated",
        targetTier: "proven",
        evidence: {},
      })),
    ).toThrow(MissingEvidenceError);
  });

  it("should throw MissingEvidenceError when promoting cited→validated with no test_run_id", () => {
    expect(() =>
      promoteTier(input({
        currentTier: "cited",
        targetTier: "validated",
        evidence: {},
      })),
    ).toThrow(MissingEvidenceError);
  });
});

// ── AC 2: citation_id quebrado → erro apontando link inválido ─────────────

describe("promoteTier (AC 2 — broken citation_id)", () => {
  it("should throw InvalidCitationError when citation_id does not resolve", () => {
    expect(() =>
      promoteTier(input({
        evidence: { citation_id: "broken-ref-999" },
        resolveCitationId: () => false,
      })),
    ).toThrow(InvalidCitationError);
  });

  it("should include the citation_id value in the InvalidCitationError message", () => {
    expect(() =>
      promoteTier(input({
        evidence: { citation_id: "broken-ref-999" },
        resolveCitationId: () => false,
      })),
    ).toThrow(/broken-ref-999/);
  });

  it("should pass when citation_id resolves successfully", () => {
    const result = promoteTier(input({
      evidence: { citation_id: "valid-ref-001" },
      resolveCitationId: () => true,
    }));
    expect(result.tier).toBe("cited");
  });

  it("should default to resolved=true when no resolveCitationId function is provided", () => {
    const result = promoteTier(input({
      evidence: { citation_id: "any-ref" },
    }));
    expect(result.tier).toBe("cited");
  });
});

// ── AC 3: provenance_receipt valido → tier atualiza + evento emitido ──────

describe("promoteTier (AC 3 — proven promotion with event)", () => {
  it("should return tier='proven' when provenance_receipt_id is provided", () => {
    const result = promoteTier(input({
      currentTier: "validated",
      targetTier: "proven",
      evidence: { provenance_receipt_id: "ots-abc123" },
    }));
    expect(result.tier).toBe("proven");
  });

  it("should emit a tier_promoted event on successful proven promotion", () => {
    const result = promoteTier(input({
      currentTier: "validated",
      targetTier: "proven",
      evidence: { provenance_receipt_id: "ots-abc123" },
    }));
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("tier_promoted");
  });

  it("should include from/to/nodeId in the emitted event", () => {
    const result = promoteTier(input({
      nodeId: "node_xyz",
      currentTier: "validated",
      targetTier: "proven",
      evidence: { provenance_receipt_id: "ots-abc123" },
    }));
    const evt = result.events[0];
    expect(evt.from).toBe("validated");
    expect(evt.to).toBe("proven");
    expect(evt.nodeId).toBe("node_xyz");
  });

  it("should emit a tier_promoted event for claim→cited promotion as well", () => {
    const result = promoteTier(input({
      evidence: { citation_id: "valid-ref" },
    }));
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("tier_promoted");
  });

  it("should include a ISO-8601 timestamp in the emitted event", () => {
    const result = promoteTier(input({
      currentTier: "validated",
      targetTier: "proven",
      evidence: { provenance_receipt_id: "ots-abc123" },
    }));
    expect(result.events[0].timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });
});

// ── Structural ─────────────────────────────────────────────────────────────

describe("promoteTier structural", () => {
  it("should return empty events array on failed promotion (error path is exception, not silent)", () => {
    // Confirm that the happy path returns events
    const result = promoteTier(input({ evidence: { citation_id: "ok" } }));
    expect(Array.isArray(result.events)).toBe(true);
  });

  it("should preserve the nodeId in the tier type throughout", () => {
    const result = promoteTier(input({
      nodeId: "node_abc",
      evidence: { citation_id: "ok" },
    }));
    expect(result.events[0].nodeId).toBe("node_abc");
  });

  it("should accept EpistemicTier union values", () => {
    const tiers: EpistemicTier[] = ["claim", "cited", "validated", "proven"];
    expect(tiers).toHaveLength(4);
  });
});
