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
 * Observability module — persistent tracing, guardrails, decisions, experiments.
 *
 * Inspired by LangWatch patterns, adapted for local-first SQLite architecture.
 * Each sub-module maps to a theoretical foundation:
 *   - TraceStore      → T1 Kalman Observability (1960)
 *   - GuardrailAdapter → T2 Design by Contract (Meyer, 1986)
 *   - DecisionStore    → T3 Decision Theory (von Neumann & Morgenstern, 1944)
 *   - DatasetStore     → T4 Hypothesis Testing (Fisher, 1925)
 *   - QualityPolicy    → T5 Safety/Liveness (Lamport, 1977)
 *   - ScenarioRunner   → T6 Mutation Testing (DeMillo et al., 1978)
 *   - Cost tracking    → T7 Bounded Rationality (Simon, 1955)
 */

export { TraceStore } from "./trace-store.js";
export type {
  TraceRecord,
  SpanRecord,
  TraceTokens,
  EndSpanOptions,
  NodeCost,
  CostSummary,
} from "./trace-store.js";

export { runGuardrailPipeline, GuardrailStore } from "./guardrail-adapter.js";
export type {
  Guardrail,
  GuardrailResult,
  GuardrailContext,
  GuardrailPipelineResult,
  GuardrailPipelineOptions,
  GuardrailExecutionRecord,
  GuardrailRecordInput,
} from "./guardrail-adapter.js";

export { DecisionStore } from "./decision-store.js";
export type {
  DecisionWeights,
  DecisionLogEntry,
  DecisionRecord,
  PolicyAccuracy,
} from "./decision-store.js";

export { DatasetStore } from "./dataset-store.js";
export type { DatasetRecord, DatasetEntry } from "./dataset-store.js";

export { ExperimentRunner } from "./experiment-runner.js";
export type {
  EvaluatorConfig,
  ExperimentRecord,
  ExperimentSummary,
  ComparisonResult,
} from "./experiment-runner.js";

export { QualityPolicyStore, evaluatePolicy } from "./quality-policy.js";
export type {
  QualityGate,
  QualityPolicy,
  GateResult,
  PolicyResult,
} from "./quality-policy.js";

export { ScenarioRunner, seedProjectWithNodes } from "./scenario-runner.js";
export type {
  Scenario,
  ScenarioStep,
  ScenarioAssertion,
  ScenarioSetup,
  ScenarioResult,
  AssertionFailure,
} from "./scenario-runner.js";

export {
  createCounter,
  createHistogram,
  getSnapshot,
  resetAll,
  httpRequestsTotal,
  httpErrorsTotal,
  httpDurationMs,
  sqliteConnectionsActive,
  eventBusQueueDepth,
  errorsRate,
} from "./metrics.js";
export type { Counter, Histogram, HistogramStats, MetricsSnapshot } from "./metrics.js";
