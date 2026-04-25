/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 3.3: Visualização de mix epistêmico no grafo
 * AC1 — GIVEN sprint com 20 nodes (10 claim, 5 cited, 3 validated, 2 proven) WHEN dashboard carrega THEN barra estratificada exibida
 * AC2 — GIVEN clique num segmento WHEN expandido THEN lista nodes do tier
 * AC3 — GIVEN epic dominantemente claim WHEN relatorio gerado THEN flag de alerta "baixa maturidade epistemica"
 */

import { describe, it, expect } from "vitest";
import {
  computeTierDistribution,
  groupNodesByTier,
  isLowMaturityEpic,
  type TierDistribution,
  type TierNode,
} from "../../core/provenance/epistemic-mix.js";
import type { EpistemicTier } from "../../core/provenance/tier-promotion.js";

function makeNode(id: string, tier: EpistemicTier): TierNode {
  return { id, title: `Node ${id}`, tier };
}

function makeNodes(counts: Record<EpistemicTier, number>): TierNode[] {
  const nodes: TierNode[] = [];
  let i = 0;
  for (const [tier, count] of Object.entries(counts) as [EpistemicTier, number][]) {
    for (let j = 0; j < count; j++) {
      nodes.push(makeNode(`n${i++}`, tier));
    }
  }
  return nodes;
}

describe("AC1 — stratified bar: tier distribution from 20 nodes", () => {
  it("should count each tier correctly", () => {
    const nodes = makeNodes({ claim: 10, cited: 5, validated: 3, proven: 2 });
    const dist = computeTierDistribution(nodes);
    expect(dist.claim).toBe(10);
    expect(dist.cited).toBe(5);
    expect(dist.validated).toBe(3);
    expect(dist.proven).toBe(2);
    expect(dist.total).toBe(20);
  });

  it("should return zero counts for missing tiers", () => {
    const nodes = [makeNode("n1", "claim"), makeNode("n2", "claim")];
    const dist = computeTierDistribution(nodes);
    expect(dist.claim).toBe(2);
    expect(dist.cited).toBe(0);
    expect(dist.validated).toBe(0);
    expect(dist.proven).toBe(0);
    expect(dist.total).toBe(2);
  });

  it("should return all-zero distribution for empty node list", () => {
    const dist = computeTierDistribution([]);
    expect(dist.total).toBe(0);
    expect(dist.claim).toBe(0);
    expect(dist.cited).toBe(0);
    expect(dist.validated).toBe(0);
    expect(dist.proven).toBe(0);
  });

  it("should compute percentages that sum to 100 for non-empty lists", () => {
    const nodes = makeNodes({ claim: 10, cited: 5, validated: 3, proven: 2 });
    const dist = computeTierDistribution(nodes);
    const sum = dist.claimPct + dist.citedPct + dist.validatedPct + dist.provenPct;
    expect(Math.round(sum)).toBe(100);
  });
});

describe("AC2 — click segment: group nodes by tier", () => {
  it("should return nodes for the requested tier", () => {
    const nodes = makeNodes({ claim: 3, cited: 2, validated: 1, proven: 0 });
    const grouped = groupNodesByTier(nodes);
    expect(grouped.claim).toHaveLength(3);
    expect(grouped.cited).toHaveLength(2);
    expect(grouped.validated).toHaveLength(1);
    expect(grouped.proven).toHaveLength(0);
  });

  it("should preserve node identity in each tier group", () => {
    const claimNode = makeNode("specific-id", "claim");
    const grouped = groupNodesByTier([claimNode, makeNode("other", "cited")]);
    expect(grouped.claim[0].id).toBe("specific-id");
    expect(grouped.cited[0].id).toBe("other");
  });

  it("should return empty arrays for tiers with no nodes", () => {
    const grouped = groupNodesByTier([makeNode("x", "proven")]);
    expect(grouped.claim).toEqual([]);
    expect(grouped.cited).toEqual([]);
    expect(grouped.validated).toEqual([]);
    expect(grouped.proven).toHaveLength(1);
  });
});

describe("AC3 — low maturity alert: epic dominantly claim", () => {
  it("should flag epic as low maturity when claim > 50%", () => {
    const dist: TierDistribution = {
      claim: 11, cited: 5, validated: 3, proven: 1,
      total: 20,
      claimPct: 55, citedPct: 25, validatedPct: 15, provenPct: 5,
    };
    expect(isLowMaturityEpic(dist)).toBe(true);
  });

  it("should not flag when claim is exactly 50%", () => {
    const dist: TierDistribution = {
      claim: 10, cited: 5, validated: 3, proven: 2,
      total: 20,
      claimPct: 50, citedPct: 25, validatedPct: 15, provenPct: 10,
    };
    expect(isLowMaturityEpic(dist)).toBe(false);
  });

  it("should not flag when claim < 50%", () => {
    const dist: TierDistribution = {
      claim: 4, cited: 6, validated: 5, proven: 5,
      total: 20,
      claimPct: 20, citedPct: 30, validatedPct: 25, provenPct: 25,
    };
    expect(isLowMaturityEpic(dist)).toBe(false);
  });

  it("should not flag empty distribution", () => {
    const dist: TierDistribution = {
      claim: 0, cited: 0, validated: 0, proven: 0,
      total: 0,
      claimPct: 0, citedPct: 0, validatedPct: 0, provenPct: 0,
    };
    expect(isLowMaturityEpic(dist)).toBe(false);
  });

  it("should flag a 100% claim epic", () => {
    const nodes = makeNodes({ claim: 10, cited: 0, validated: 0, proven: 0 });
    const dist = computeTierDistribution(nodes);
    expect(isLowMaturityEpic(dist)).toBe(true);
  });
});
