import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  runGuardrailPipeline,
  type Guardrail,
  type GuardrailResult,
  type GuardrailContext,
  GuardrailStore,
} from "../../core/observability/guardrail-adapter.js";
import { TraceStore } from "../../core/observability/trace-store.js";
import { runMigrations } from "../../core/store/migrations.js";

describe("GuardrailAdapter", () => {
  let db: Database.Database;
  let guardrailStore: GuardrailStore;
  let traceStore: TraceStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    guardrailStore = new GuardrailStore(db);
    traceStore = new TraceStore(db);
  });

  const passingGuardrail: Guardrail = {
    name: "test_pass",
    position: "post",
    strategy: "fail_closed",
    run: (): GuardrailResult => ({
      passed: true,
      score: 95,
      name: "test_pass",
      details: "All checks passed",
      strategy: "fail_closed",
    }),
  };

  const failingGuardrailClosed: Guardrail = {
    name: "test_fail_closed",
    position: "post",
    strategy: "fail_closed",
    run: (): GuardrailResult => ({
      passed: false,
      score: 30,
      name: "test_fail_closed",
      details: "Security violation detected",
      strategy: "fail_closed",
    }),
  };

  const failingGuardrailOpen: Guardrail = {
    name: "test_fail_open",
    position: "post",
    strategy: "fail_open",
    run: (): GuardrailResult => ({
      passed: false,
      score: 40,
      name: "test_fail_open",
      details: "Minor quality issue",
      strategy: "fail_open",
    }),
  };

  const ctx: GuardrailContext = { projectPath: "/test" };

  // ── Pipeline execution ───────────────────────────────

  it("should execute guardrails and return structured results", () => {
    const result = runGuardrailPipeline([passingGuardrail], ctx);

    expect(result.results).toHaveLength(1);
    expect(result.allPassed).toBe(true);
    expect(result.blockingFailures).toHaveLength(0);
    expect(result.results[0]!.passed).toBe(true);
    expect(result.results[0]!.score).toBe(95);
  });

  it("should block on fail_closed failure", () => {
    const result = runGuardrailPipeline(
      [passingGuardrail, failingGuardrailClosed],
      ctx,
    );

    expect(result.allPassed).toBe(false);
    expect(result.blockingFailures).toHaveLength(1);
    expect(result.blockingFailures[0]!.name).toBe("test_fail_closed");
  });

  it("should continue on fail_open failure (not blocking)", () => {
    const result = runGuardrailPipeline(
      [passingGuardrail, failingGuardrailOpen],
      ctx,
    );

    expect(result.allPassed).toBe(false);
    expect(result.blockingFailures).toHaveLength(0);
    expect(result.results).toHaveLength(2);
  });

  it("should handle mixed fail_open and fail_closed failures", () => {
    const result = runGuardrailPipeline(
      [failingGuardrailOpen, passingGuardrail, failingGuardrailClosed],
      ctx,
    );

    expect(result.allPassed).toBe(false);
    expect(result.blockingFailures).toHaveLength(1);
    expect(result.results).toHaveLength(3);
  });

  it("should handle empty guardrails list", () => {
    const result = runGuardrailPipeline([], ctx);

    expect(result.allPassed).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(result.blockingFailures).toHaveLength(0);
  });

  // ── Persistence ──────────────────────────────────────

  it("should persist results to guardrail_executions when store provided", () => {
    const traceId = traceStore.beginTrace("thread_1", "node_1", "finish_task");

    runGuardrailPipeline(
      [passingGuardrail, failingGuardrailClosed],
      ctx,
      { traceId, store: guardrailStore },
    );

    const rows = guardrailStore.getByTrace(traceId);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe("test_pass");
    expect(rows[0]!.passed).toBe(true);
    expect(rows[1]!.name).toBe("test_fail_closed");
    expect(rows[1]!.passed).toBe(false);
  });

  it("should not persist when no store provided", () => {
    // Should not throw even without store
    const result = runGuardrailPipeline([passingGuardrail], ctx);
    expect(result.allPassed).toBe(true);
  });

  // ── GuardrailStore queries ───────────────────────────

  it("should query guardrail executions by trace", () => {
    const traceId = traceStore.beginTrace("thread_1", "node_1", "finish_task");

    guardrailStore.record({
      traceId,
      name: "security",
      position: "post",
      passed: true,
      score: 90,
      latencyMs: 5,
      strategy: "fail_closed",
      details: "OK",
    });

    guardrailStore.record({
      traceId,
      name: "quality",
      position: "post",
      passed: false,
      score: 40,
      latencyMs: 3,
      strategy: "fail_open",
      details: "Low quality",
    });

    const results = guardrailStore.getByTrace(traceId);
    expect(results).toHaveLength(2);
  });

  it("should compute pass rate for a trace", () => {
    const traceId = traceStore.beginTrace("thread_1", "node_1", "finish_task");

    guardrailStore.record({ traceId, name: "a", position: "post", passed: true, score: 90, latencyMs: 1, strategy: "fail_closed", details: "" });
    guardrailStore.record({ traceId, name: "b", position: "post", passed: false, score: 30, latencyMs: 1, strategy: "fail_open", details: "" });
    guardrailStore.record({ traceId, name: "c", position: "post", passed: true, score: 80, latencyMs: 1, strategy: "fail_closed", details: "" });

    const rate = guardrailStore.getPassRate(traceId);
    expect(rate).toBeCloseTo(2 / 3);
  });
});
