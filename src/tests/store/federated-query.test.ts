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
  federatedQuery,
  type StoreAdapter,
  type FederatedQueryInput,
  type StoreId,
} from "../../core/store/federated-query.js";

// ── Test helpers ──────────────────────────────────────────────────────────

function makeAdapter(storeId: StoreId, results: unknown[]): StoreAdapter {
  return {
    storeId,
    query: async (_q: string) => results,
  };
}

function makeOfflineAdapter(storeId: StoreId): StoreAdapter {
  return {
    storeId,
    query: async (_q: string) => {
      throw new Error(`${storeId} store unavailable`);
    },
  };
}

// ── AC 1: provenance query → source_store=provenance ─────────────────────

describe("federatedQuery (AC 1 — provenance routing)", () => {
  it("should return results with source_store=provenance for provenance queries", async () => {
    const adapters: StoreAdapter[] = [
      makeAdapter("provenance", [{ hash: "abc123", data: "provenance data" }]),
      makeAdapter("graph", [{ id: "node-1" }]),
    ];

    const input: FederatedQueryInput = {
      query: "hash de provenance de abc123",
      stores: ["provenance", "graph"],
    };

    const result = await federatedQuery(input, adapters);

    const provenanceItems = result.items.filter(i => i.source_store === "provenance");
    expect(provenanceItems.length).toBeGreaterThan(0);
    expect(provenanceItems[0].source_store).toBe("provenance");
  });

  it("should tag every item with its originating store", async () => {
    const adapters: StoreAdapter[] = [
      makeAdapter("provenance", [{ hash: "abc123" }]),
    ];

    const input: FederatedQueryInput = {
      query: "hash abc123",
      stores: ["provenance"],
    };

    const result = await federatedQuery(input, adapters);
    for (const item of result.items) {
      expect(item.source_store).toBeDefined();
      expect(typeof item.source_store).toBe("string");
    }
  });

  it("should return empty items when no results from any store", async () => {
    const adapters: StoreAdapter[] = [
      makeAdapter("provenance", []),
      makeAdapter("graph", []),
    ];

    const result = await federatedQuery(
      { query: "nonexistent", stores: ["provenance", "graph"] },
      adapters,
    );

    expect(result.items).toHaveLength(0);
  });
});

// ── AC 2: cross-store query → merged results with per-item origin ─────────

describe("federatedQuery (AC 2 — cross-store merge)", () => {
  it("should merge results from graph and memory stores", async () => {
    const graphItem = { id: "node-1", title: "Task A" };
    const memoryItem = { key: "memory-1", content: "remembered fact" };

    const adapters: StoreAdapter[] = [
      makeAdapter("graph", [graphItem]),
      makeAdapter("memory", [memoryItem]),
    ];

    const result = await federatedQuery(
      { query: "anything", stores: ["graph", "memory"] },
      adapters,
    );

    expect(result.items).toHaveLength(2);

    const graphResult = result.items.find(i => i.source_store === "graph");
    const memoryResult = result.items.find(i => i.source_store === "memory");

    expect(graphResult).toBeDefined();
    expect(graphResult!.data).toEqual(graphItem);
    expect(memoryResult).toBeDefined();
    expect(memoryResult!.data).toEqual(memoryItem);
  });

  it("should preserve the data payload from each store without mutation", async () => {
    const original = { id: "x", value: 42 };
    const adapters: StoreAdapter[] = [makeAdapter("graph", [original])];

    const result = await federatedQuery(
      { query: "test", stores: ["graph"] },
      adapters,
    );

    expect(result.items[0].data).toEqual(original);
  });

  it("should include results from all requested stores in the merged output", async () => {
    const adapters: StoreAdapter[] = [
      makeAdapter("graph", [{ id: "g1" }]),
      makeAdapter("memory", [{ id: "m1" }]),
      makeAdapter("knowledge", [{ id: "k1" }]),
    ];

    const result = await federatedQuery(
      { query: "broad query", stores: ["graph", "memory", "knowledge"] },
      adapters,
    );

    const sources = new Set(result.items.map(i => i.source_store));
    expect(sources.has("graph")).toBe(true);
    expect(sources.has("memory")).toBe(true);
    expect(sources.has("knowledge")).toBe(true);
  });
});

// ── AC 3: store offline → fallback with warning, no throw ─────────────────

describe("federatedQuery (AC 3 — offline fallback)", () => {
  it("should not throw when a store is offline", async () => {
    const adapters: StoreAdapter[] = [
      makeOfflineAdapter("graph"),
      makeAdapter("memory", [{ id: "m1" }]),
    ];

    await expect(
      federatedQuery({ query: "test", stores: ["graph", "memory"] }, adapters),
    ).resolves.toBeDefined();
  });

  it("should include a warning when a store fails", async () => {
    const adapters: StoreAdapter[] = [
      makeOfflineAdapter("knowledge"),
      makeAdapter("memory", [{ id: "m1" }]),
    ];

    const result = await federatedQuery(
      { query: "test", stores: ["knowledge", "memory"] },
      adapters,
    );

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("knowledge");
  });

  it("should still return results from healthy stores when one fails", async () => {
    const adapters: StoreAdapter[] = [
      makeOfflineAdapter("provenance"),
      makeAdapter("graph", [{ id: "g1" }]),
    ];

    const result = await federatedQuery(
      { query: "test", stores: ["provenance", "graph"] },
      adapters,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].source_store).toBe("graph");
  });

  it("should return empty items with warning when all stores are offline", async () => {
    const adapters: StoreAdapter[] = [
      makeOfflineAdapter("graph"),
      makeOfflineAdapter("memory"),
    ];

    const result = await federatedQuery(
      { query: "test", stores: ["graph", "memory"] },
      adapters,
    );

    expect(result.items).toHaveLength(0);
    expect(result.warnings.length).toBe(2);
  });
});

// ── Structural ─────────────────────────────────────────────────────────────

describe("federatedQuery structural invariants", () => {
  it("should return FederatedQueryResult with items and warnings arrays", async () => {
    const adapters: StoreAdapter[] = [makeAdapter("graph", [])];

    const result = await federatedQuery({ query: "x", stores: ["graph"] }, adapters);

    expect(Array.isArray(result.items)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("should query only the requested stores, not all adapters", async () => {
    let graphQueried = false;
    const adapters: StoreAdapter[] = [
      {
        storeId: "graph",
        query: async (_q) => { graphQueried = true; return []; },
      },
      makeAdapter("memory", []),
    ];

    await federatedQuery({ query: "x", stores: ["memory"] }, adapters);

    expect(graphQueried).toBe(false);
  });
});
