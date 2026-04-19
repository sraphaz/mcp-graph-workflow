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

export { runAdrChallengeGate } from './adr-challenge-gate.js';
export type { GateMode, GateWarning, AdrChallengeGateResult } from './adr-challenge-gate.js';
export { runAdrChallenge, runAllAdrChallenges } from './adr-challenge-runner.js';
export type { AdrChallengeResult, AllAdrChallengesResult } from './adr-challenge-runner.js';
export { validateAdrs } from './adr-validator.js';
export { suggestAlternatives } from './alternative-suggester.js';
export type { ScoreDelta, AlternativeSuggestion } from './alternative-suggester.js';
export { assembleChallengeReport, serializeChallengeReport } from './challenge-report.js';
export type { JtbdTestResult, ChallengeReportInput, ChallengeVerdict, ChallengeVerdictResult, ChallengeReport, ContextTier } from './challenge-report.js';
export { analyzeCoupling } from './coupling-analyzer.js';
export { scoreFriction, scoreOptimality, scoreReversibility, computeDecisionFitness } from './decision-fitness.js';
export type { FrictionResult, Jtbd, OptimalityResult, ReversibilityResult, DecisionFitnessGrade, DecisionFitnessResult } from './decision-fitness.js';
export { BUILT_IN_PRINCIPLES, evaluateDecisionPrinciples } from './decision-principles.js';
export type { DecisionPrinciple, PrincipleViolation } from './decision-principles.js';
export { checkDesignReadiness } from './definition-of-ready.js';
export { checkInterfaces } from './interface-checker.js';
export { extractJtbds, runJtbdTests } from './jtbd-runner.js';
export type { JtbdTestStatus } from './jtbd-runner.js';
export { FAILURE_MODE_CATEGORIES, generatePreMortem, calculateSeverity } from './premortem-generator.js';
export type { FailureModeCategory, FailureModeSeverity, FailureMode, PreMortreGraphDoc } from './premortem-generator.js';
export { classifyFindingSeverity, sortFindings, elevateFindings } from './severity-scoring.js';
export type { FindingSeverity, FindingSource, FindingDimension, Finding } from './severity-scoring.js';
export { assessMitigationLevel, assessTechRisks } from './tech-risk-assessor.js';
export { buildTraceabilityMatrix } from './traceability-matrix.js';
