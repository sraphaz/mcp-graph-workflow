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

export { computeConfidence } from './confidence-scorer.js';
export type { ConfidenceInput, ConfidenceDecision, ConfidenceEvidence } from './confidence-scorer.js';
export { AutopilotController } from './autopilot-controller.js';
export type { AutopilotConfig, AutopilotDecision, AutopilotSession, EvaluateInput } from './autopilot-controller.js';
export { AutopilotBridge } from './autopilot-bridge.js';
export type { PhaseChangeResult } from './autopilot-bridge.js';
export { createCheckpoint, rollbackToCheckpoint } from './graph-rollback.js';
export type { GraphCheckpoint, RollbackResult } from './graph-rollback.js';
export { createShadowBranch, mergeShadowBranch, discardShadowBranch, getShadowBranchName } from './shadow-branch.js';
export type { ShadowBranchResult, MergeResult, DiscardResult } from './shadow-branch.js';
export { RecoveryOrchestrator } from './recovery-orchestrator.js';
export type { RecoveryConfig, RecoveryResult, RecoveryMetrics } from './recovery-orchestrator.js';
export { AutopilotRecoveryBridge } from './autopilot-recovery-bridge.js';
export type { AutopilotRecoveryResult } from './autopilot-recovery-bridge.js';
export { EscalationEmitter } from './escalation-emitter.js';
export type { EscalationEvent } from './escalation-emitter.js';
export { RecoveryMetricsStore } from './recovery-metrics-store.js';
export type { RecoveryMetricEntry, RecoveryMetricsSummary } from './recovery-metrics-store.js';
