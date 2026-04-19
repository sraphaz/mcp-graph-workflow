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

export { TaskPrefetcher } from './task-prefetcher.js';
export type { PrefetchedContext, PrefetchStats, PrefetchOptions } from './task-prefetcher.js';
export { analyzeAutoReady } from './auto-ready.js';
export type { AutoReadyReport } from './auto-ready.js';
export { detectLargeTasks } from './decompose.js';
export type { DecomposeResult, SuggestedSubtask } from './decompose.js';
export { findTransitiveBlockers, detectCycles, findCriticalPath } from './dependency-chain.js';
export { findEnhancedNextTask } from './enhanced-next.js';
export type { EnhancedNextResult, EnhancedNextOptions } from './enhanced-next.js';
export { detectCurrentPhase, getPhaseGuidance, validatePhaseTransition, checkToolGate, checkStatusGate, PHASE_PREREQUISITES, checkPrerequisiteGate, detectWarnings } from './lifecycle-phase.js';
export type { LifecyclePhase, McpAgentSuggestion, PhaseGuidance, PhaseDetectionOptions, LifecycleWarning, StrictnessMode, PhaseGateResult, StatusGateResult, PrerequisiteScope, PrerequisiteRequiredTool, PrerequisiteRule } from './lifecycle-phase.js';
export { computeNextAction } from './next-action.js';
export type { NextAction } from './next-action.js';
export { findNextTask } from './next-task.js';
export type { NextTaskResult, NextTaskOptions } from './next-task.js';
export { generatePlanningReport } from './planning-report.js';
export type { PlanningReport } from './planning-report.js';
export { smartDecompose } from './smart-decompose.js';
export type { DecomposedSubtask, DecomposedEdge } from './smart-decompose.js';
export { analyzeSprintHealth } from './sprint-health.js';
export type { SprintHealthReport } from './sprint-health.js';
export { calculateVelocity } from './velocity.js';
export type { SprintVelocity, VelocityTask, CategoryVelocity, VelocitySummary } from './velocity.js';
