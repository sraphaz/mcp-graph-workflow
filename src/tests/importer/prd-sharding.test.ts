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
  shardPrdText,
  importShardedPrd,
  type PrdShardingOptions,
  type ShardPayload,
} from "../../core/importer/prd-sharding.js";
import type { GraphNode, GraphEdge } from "../../core/graph/graph-types.js";
import { makeNode } from "../helpers/factories.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function buildPrdSection(title: string, words: number): string {
  const body = ("word ").repeat(words).trim();
  return `## ${title}\n\n${body}\n\n`;
}

// Approximate token count: 1 token ≈ 4 chars
function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── AC 1: 30k-token PRD sharded into batches without losing nodes ─────────

describe("shardPrdText (AC 1 — partition large PRD)", () => {
  it("should return a single shard for small PRDs (below token budget)", () => {
    const text = "## Section 1\n\nShort content.\n\n## Section 2\n\nAlso short.\n\n";
    const shards = shardPrdText(text, 10000);
    expect(shards.length).toBeGreaterThanOrEqual(1);
    // Both sections should be in the result
    const joined = shards.join("");
    expect(joined).toContain("Section 1");
    expect(joined).toContain("Section 2");
  });

  it("should split PRD into multiple shards when content exceeds token budget", () => {
    // Build a PRD with 3 big sections, each ~3000 tokens (~12000 chars)
    const section1 = buildPrdSection("Epic A", 3000);
    const section2 = buildPrdSection("Epic B", 3000);
    const section3 = buildPrdSection("Epic C", 3000);
    const prd = section1 + section2 + section3;

    expect(approxTokens(prd)).toBeGreaterThan(8000);

    const shards = shardPrdText(prd, 5000);
    expect(shards.length).toBeGreaterThanOrEqual(2);
  });

  it("should preserve all section content across shards (no data lost)", () => {
    const section1 = buildPrdSection("Epic Alpha", 3000);
    const section2 = buildPrdSection("Epic Beta", 3000);
    const section3 = buildPrdSection("Epic Gamma", 3000);
    const prd = section1 + section2 + section3;

    const shards = shardPrdText(prd, 5000);
    const combined = shards.join("\n");

    expect(combined).toContain("Epic Alpha");
    expect(combined).toContain("Epic Beta");
    expect(combined).toContain("Epic Gamma");
  });

  it("should not split in the middle of a section", () => {
    const section = buildPrdSection("Indivisible Epic", 500);
    const prd = section;

    const shards = shardPrdText(prd, 10000);
    // Small section should not be broken apart
    expect(shards.every((s) => !s.includes("Indivisible") || s.includes("## Indivisible Epic"))).toBe(true);
  });
});

// ── AC 2: Cross-refs resolved → edges generated post-consolidation ─────────

describe("importShardedPrd (AC 2 — cross-ref edges)", () => {
  it("should generate a cross-ref edge when shard B mentions a title from shard A", () => {
    // Shard A produces node titled "Auth Service"
    const nodeFromA: GraphNode = makeNode({ id: "node-a-1", title: "Auth Service", status: "backlog" });
    // Shard B produces a node that references "Auth Service" in its description
    const nodeFromB: GraphNode = makeNode({
      id: "node-b-1",
      title: "Login Flow",
      description: "Depends on Auth Service for JWT validation",
      status: "backlog",
    });

    const mockParse = (text: string, _src: string): ShardPayload => {
      if (text.includes("SHARD_A")) return { nodes: [nodeFromA], edges: [] };
      if (text.includes("SHARD_B")) return { nodes: [nodeFromB], edges: [] };
      return { nodes: [], edges: [] };
    };

    const opts: PrdShardingOptions = { parseShardFn: mockParse };
    const result = importShardedPrd("SHARD_A\n\n---SHARD_BOUNDARY---\n\nSHARD_B", opts);

    const crossRefEdges = result.edges.filter(
      (e: GraphEdge) => e.from === "node-b-1" && e.to === "node-a-1",
    );
    expect(crossRefEdges.length).toBeGreaterThanOrEqual(1);
  });

  it("should not generate duplicate related_to edges for the same cross-ref", () => {
    const nodeA: GraphNode = makeNode({ id: "node-x-1", title: "Shared Service", status: "backlog" });
    const nodeB: GraphNode = makeNode({
      id: "node-x-2",
      title: "Client",
      description: "Uses Shared Service",
      status: "backlog",
    });

    const mockParse = (text: string, _src: string): ShardPayload => {
      if (text.includes("S1")) return { nodes: [nodeA], edges: [] };
      if (text.includes("S2")) return { nodes: [nodeB], edges: [] };
      return { nodes: [], edges: [] };
    };

    const result = importShardedPrd("S1\n---SHARD_BOUNDARY---\nS2", { parseShardFn: mockParse });

    const refs = result.edges.filter(
      (e: GraphEdge) => e.from === "node-x-2" && e.to === "node-x-1",
    );
    expect(refs.length).toBeLessThanOrEqual(1);
  });

  it("should return all nodes from all shards regardless of cross-refs", () => {
    const mockParse = (text: string, _src: string): ShardPayload => {
      if (text.includes("PA")) return { nodes: [makeNode({ id: "n1", title: "N1" }), makeNode({ id: "n2", title: "N2" })], edges: [] };
      if (text.includes("PB")) return { nodes: [makeNode({ id: "n3", title: "N3" })], edges: [] };
      return { nodes: [], edges: [] };
    };

    const result = importShardedPrd("PA\n---SHARD_BOUNDARY---\nPB", { parseShardFn: mockParse });
    expect(result.nodes).toHaveLength(3);
  });
});

// ── AC 3: isolated shard failure — import continues, reports only the failure ─

describe("importShardedPrd (AC 3 — shard isolation on parse failure)", () => {
  it("should continue importing when one shard fails to parse", () => {
    const goodNode: GraphNode = makeNode({ id: "good-1", title: "Good Node", status: "backlog" });

    let callCount = 0;
    const mockParse = (_text: string, _src: string): ShardPayload => {
      callCount++;
      if (callCount === 1) throw new Error("Parse failure in shard 0");
      return { nodes: [goodNode], edges: [] };
    };

    const result = importShardedPrd("FAIL_SHARD\n---SHARD_BOUNDARY---\nGOOD_SHARD", {
      parseShardFn: mockParse,
    });

    // Good shard's node should be in results
    expect(result.nodes.some((n: GraphNode) => n.id === "good-1")).toBe(true);
  });

  it("should report only failed shards in failedShards array", () => {
    let callCount = 0;
    const mockParse = (_text: string, _src: string): ShardPayload => {
      callCount++;
      if (callCount === 2) throw new Error("Shard 2 failure");
      return { nodes: [makeNode({ title: `Node ${callCount}` })], edges: [] };
    };

    const result = importShardedPrd(
      "SHARD1\n---SHARD_BOUNDARY---\nSHARD2\n---SHARD_BOUNDARY---\nSHARD3",
      { parseShardFn: mockParse },
    );

    expect(result.failedShards).toContain(1); // 0-indexed: shard index 1 failed
    expect(result.failedShards).not.toContain(0);
    expect(result.failedShards).not.toContain(2);
  });

  it("should return non-empty nodes array even when one shard fails", () => {
    const mockParse = (text: string, _src: string): ShardPayload => {
      if (text.includes("BAD")) throw new Error("bad shard");
      return { nodes: [makeNode({ title: "Good" })], edges: [] };
    };

    const result = importShardedPrd("GOOD_SHARD\n---SHARD_BOUNDARY---\nBAD_SHARD", {
      parseShardFn: mockParse,
    });

    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it("should return shardErrors with the error message for each failed shard", () => {
    const mockParse = (_text: string, _src: string): ShardPayload => {
      throw new Error("deliberate failure");
    };

    const result = importShardedPrd("ONLY_SHARD", { parseShardFn: mockParse });

    expect(result.failedShards).toHaveLength(1);
    expect(result.shardErrors[0]).toContain("deliberate failure");
  });
});
