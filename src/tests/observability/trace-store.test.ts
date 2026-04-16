import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { TraceStore, type SpanRecord } from "../../core/observability/trace-store.js";
import { runMigrations } from "../../core/store/migrations.js";

describe("TraceStore", () => {
  let db: Database.Database;
  let store: TraceStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new TraceStore(db);
  });

  // ── Trace lifecycle ──────────────────────────────────

  it("should create trace and return traceId", () => {
    const traceId = store.beginTrace("thread_1", "node_1", "start_task");

    expect(traceId).toMatch(/^trace_/);

    const trace = store.getTrace(traceId);
    expect(trace).not.toBeNull();
    expect(trace!.threadId).toBe("thread_1");
    expect(trace!.nodeId).toBe("node_1");
    expect(trace!.toolName).toBe("start_task");
    expect(trace!.status).toBe("running");
  });

  it("should close trace with status, latency, and tokens", () => {
    const traceId = store.beginTrace("thread_1", "node_1", "finish_task");

    store.endTrace(traceId, "completed", { tokensIn: 500, tokensOut: 200, estimatedCostUsd: 0.003 });

    const trace = store.getTrace(traceId);
    expect(trace!.status).toBe("completed");
    expect(trace!.endedAt).not.toBeNull();
    expect(trace!.latencyMs).toBeGreaterThanOrEqual(0);
    expect(trace!.tokensIn).toBe(500);
    expect(trace!.tokensOut).toBe(200);
    expect(trace!.estimatedCostUsd).toBeCloseTo(0.003);
  });

  it("should create trace without nodeId (for non-task operations)", () => {
    const traceId = store.beginTrace("thread_1", null, "search");

    const trace = store.getTrace(traceId);
    expect(trace!.nodeId).toBeNull();
  });

  // ── Span lifecycle ───────────────────────────────────

  it("should add spans to trace with parent-child relationships", () => {
    const traceId = store.beginTrace("thread_1", "node_1", "start_task");

    const parentSpanId = store.addSpan(traceId, "rag_pipeline");
    const childSpanId = store.addSpan(traceId, "retrieval", parentSpanId);

    expect(parentSpanId).toMatch(/^span_/);
    expect(childSpanId).toMatch(/^span_/);

    const spans = store.getSpansByTrace(traceId);
    expect(spans).toHaveLength(2);

    const child = spans.find((s: SpanRecord) => s.id === childSpanId);
    expect(child!.parentSpanId).toBe(parentSpanId);
  });

  it("should compute latency on endSpan", () => {
    const traceId = store.beginTrace("thread_1", "node_1", "start_task");
    const spanId = store.addSpan(traceId, "retrieval");

    store.endSpan(spanId, { outputSummary: "5 results retrieved" });

    const spans = store.getSpansByTrace(traceId);
    const span = spans.find((s: SpanRecord) => s.id === spanId);
    expect(span!.endedAt).not.toBeNull();
    expect(span!.latencyMs).toBeGreaterThanOrEqual(0);
    expect(span!.outputSummary).toBe("5 results retrieved");
  });

  // ── Queries ──────────────────────────────────────────

  it("should query traces by node_id", () => {
    store.beginTrace("thread_1", "node_A", "start_task");
    store.beginTrace("thread_1", "node_A", "finish_task");
    store.beginTrace("thread_1", "node_B", "start_task");

    const tracesA = store.getTracesByNode("node_A");
    expect(tracesA).toHaveLength(2);

    const tracesB = store.getTracesByNode("node_B");
    expect(tracesB).toHaveLength(1);
  });

  it("should query traces by thread_id", () => {
    store.beginTrace("thread_X", "node_1", "start_task");
    store.beginTrace("thread_X", "node_2", "finish_task");
    store.beginTrace("thread_Y", "node_3", "start_task");

    const tracesX = store.getTracesByThread("thread_X");
    expect(tracesX).toHaveLength(2);

    const tracesY = store.getTracesByThread("thread_Y");
    expect(tracesY).toHaveLength(1);
  });

  // ── Cost tracking (Concept 7 — T7 Bounded Rationality) ──

  it("should track tokens and cost per node", () => {
    const t1 = store.beginTrace("thread_1", "node_1", "start_task");
    store.endTrace(t1, "completed", { tokensIn: 1000, tokensOut: 500, estimatedCostUsd: 0.01 });

    const t2 = store.beginTrace("thread_1", "node_1", "finish_task");
    store.endTrace(t2, "completed", { tokensIn: 2000, tokensOut: 1000, estimatedCostUsd: 0.02 });

    const cost = store.getCostByNode("node_1");
    expect(cost.totalTokens).toBe(4500);
    expect(cost.estimatedCostUsd).toBeCloseTo(0.03);
    expect(cost.traceCount).toBe(2);
  });

  it("should return zero cost for unknown node", () => {
    const cost = store.getCostByNode("nonexistent");
    expect(cost.totalTokens).toBe(0);
    expect(cost.estimatedCostUsd).toBe(0);
    expect(cost.traceCount).toBe(0);
  });

  it("should compute cost summary across all nodes", () => {
    const t1 = store.beginTrace("thread_1", "node_1", "start_task");
    store.endTrace(t1, "completed", { tokensIn: 1000, tokensOut: 500, estimatedCostUsd: 0.01 });

    const t2 = store.beginTrace("thread_1", "node_2", "start_task");
    store.endTrace(t2, "completed", { tokensIn: 3000, tokensOut: 1500, estimatedCostUsd: 0.03 });

    const summary = store.getCostSummary();
    expect(summary.totalCost).toBeCloseTo(0.04);
    expect(summary.avgTokensPerTask).toBe(3000); // (1500 + 4500) / 2
    expect(summary.avgCostPerTask).toBeCloseTo(0.02);
  });

  // ── Resilience ───────────────────────────────────────

  it("should return null for nonexistent trace", () => {
    const trace = store.getTrace("nonexistent");
    expect(trace).toBeNull();
  });

  it("should handle endTrace on already-closed trace gracefully", () => {
    const traceId = store.beginTrace("thread_1", "node_1", "start_task");
    store.endTrace(traceId, "completed");

    // Should not throw — idempotent
    expect(() => store.endTrace(traceId, "error")).not.toThrow();
  });
});
