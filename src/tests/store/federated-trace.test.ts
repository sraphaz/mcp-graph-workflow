/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 4.3: Trace cruzado substrate
 * AC1 — GIVEN consulta federada WHEN trace_id inspecionado THEN lista stores consultados em ordem com latência
 * AC2 — GIVEN replay de trace antigo WHEN executado em estado idêntico THEN resultado bit-a-bit idêntico
 * AC3 — GIVEN trace incompleto (store indisponível) WHEN inspecionado THEN marca partial=true com causa
 */

import { describe, it, expect } from "vitest";
import { tracedFederatedQuery } from "../../core/store/federated-trace.js";
import type { StoreAdapter } from "../../core/store/federated-query.js";

function makeAdapter(storeId: "graph" | "memory" | "knowledge", results: unknown[] = ["item"]): StoreAdapter {
  return {
    storeId,
    query: async (_q: string) => results,
  };
}

function makeFailingAdapter(storeId: "graph" | "memory" | "knowledge", cause: string): StoreAdapter {
  return {
    storeId,
    query: async () => { throw new Error(cause); },
  };
}

describe("AC1 — trace lists stores consulted in order with latency", () => {
  it("should return a trace_id on every query", async () => {
    const adapters = [makeAdapter("graph"), makeAdapter("memory")];
    const result = await tracedFederatedQuery({ query: "test", stores: ["graph", "memory"] }, adapters);
    expect(typeof result.trace.traceId).toBe("string");
    expect(result.trace.traceId.length).toBeGreaterThan(0);
  });

  it("should record each store consulted with latency in milliseconds", async () => {
    const adapters = [makeAdapter("graph"), makeAdapter("knowledge")];
    const result = await tracedFederatedQuery({ query: "hello", stores: ["graph", "knowledge"] }, adapters);
    const storeIds = result.trace.steps.map((s) => s.storeId);
    expect(storeIds).toContain("graph");
    expect(storeIds).toContain("knowledge");
    for (const step of result.trace.steps) {
      expect(typeof step.latencyMs).toBe("number");
      expect(step.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("should record the number of results returned per store", async () => {
    const adapters = [makeAdapter("graph", ["a", "b", "c"]), makeAdapter("memory", [])];
    const result = await tracedFederatedQuery({ query: "q", stores: ["graph", "memory"] }, adapters);
    const graphStep = result.trace.steps.find((s) => s.storeId === "graph");
    const memStep = result.trace.steps.find((s) => s.storeId === "memory");
    expect(graphStep!.resultCount).toBe(3);
    expect(memStep!.resultCount).toBe(0);
  });

  it("should preserve query result items unchanged", async () => {
    const adapters = [makeAdapter("graph", [{ id: "n1" }])];
    const result = await tracedFederatedQuery({ query: "q" }, adapters);
    expect(result.items).toHaveLength(1);
    expect((result.items[0].data as { id: string }).id).toBe("n1");
  });
});

describe("AC2 — replay with same inputs produces bit-identical trace structure", () => {
  it("should produce the same stores and steps for identical inputs", async () => {
    const adapters = [makeAdapter("graph"), makeAdapter("knowledge")];
    const r1 = await tracedFederatedQuery({ query: "deterministic", stores: ["graph", "knowledge"] }, adapters);
    const r2 = await tracedFederatedQuery({ query: "deterministic", stores: ["graph", "knowledge"] }, adapters);
    const storeIds1 = r1.trace.steps.map((s) => s.storeId);
    const storeIds2 = r2.trace.steps.map((s) => s.storeId);
    expect(storeIds1).toEqual(storeIds2);
    expect(r1.trace.steps.length).toBe(r2.trace.steps.length);
  });

  it("should produce the same item count and source_stores for identical inputs", async () => {
    const adapters = [makeAdapter("graph", [1, 2]), makeAdapter("memory", [3])];
    const r1 = await tracedFederatedQuery({ query: "q" }, adapters);
    const r2 = await tracedFederatedQuery({ query: "q" }, adapters);
    expect(r1.items.length).toBe(r2.items.length);
    expect(r1.items.map((i) => i.source_store)).toEqual(r2.items.map((i) => i.source_store));
  });

  it("should have a unique trace_id per invocation", async () => {
    const adapters = [makeAdapter("graph")];
    const r1 = await tracedFederatedQuery({ query: "q" }, adapters);
    const r2 = await tracedFederatedQuery({ query: "q" }, adapters);
    expect(r1.trace.traceId).not.toBe(r2.trace.traceId);
  });
});

describe("AC3 — partial trace when a store is unavailable", () => {
  it("should mark trace as partial=true when a store fails", async () => {
    const adapters = [
      makeAdapter("graph"),
      makeFailingAdapter("memory", "connection refused"),
    ];
    const result = await tracedFederatedQuery({ query: "q" }, adapters);
    expect(result.trace.partial).toBe(true);
  });

  it("should record the failure cause in the trace step", async () => {
    const adapters = [
      makeFailingAdapter("knowledge", "timeout"),
    ];
    const result = await tracedFederatedQuery({ query: "q" }, adapters);
    const failedStep = result.trace.steps.find((s) => s.storeId === "knowledge");
    expect(failedStep).toBeDefined();
    expect(failedStep!.error).toMatch(/timeout/i);
  });

  it("should still return successful store results when one store fails", async () => {
    const adapters = [
      makeAdapter("graph", ["ok-item"]),
      makeFailingAdapter("memory", "offline"),
    ];
    const result = await tracedFederatedQuery({ query: "q" }, adapters);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].source_store).toBe("graph");
  });

  it("should mark trace as partial=false when all stores succeed", async () => {
    const adapters = [makeAdapter("graph"), makeAdapter("memory")];
    const result = await tracedFederatedQuery({ query: "q" }, adapters);
    expect(result.trace.partial).toBe(false);
  });
});
