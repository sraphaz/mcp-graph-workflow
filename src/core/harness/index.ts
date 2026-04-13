/**
 * Harness Engineering — Barrel file
 *
 * Single entry point for all harness module exports.
 * Consumers should import from this file instead of individual modules.
 */

// ── Violation Detail Types (Remediation Engine v4) ─────
export type {
  ViolationDetail,
  RemediationSuggestion,
  ValidationResult,
  HarnessDimension,
  RemediationCategory,
} from "./violation-detail.js";

// ── Remediation Rules (v4) ─────────────────────────────
export { listRules, findRule, resolveTemplate, type RemediationRule } from "./remediation-rules.js";

// ── Suppression Store (v4) ─────────────────────────────
export { SuppressionStore, type SuppressionRecord } from "./remediation-suppression.js";

// ── Remediation Engine (v4) ────────────────────────────
export { evaluate as evaluateRemediations } from "./remediation-engine.js";

// ── Remediation Validator (v4) ─────────────────────────
export { RemediationValidator, type PostFixResult } from "./remediation-validator.js";

// ── Harness Trends (v4) ────────────────────────────────
export { getTrends, predictGradeTarget, type TrendResult, type GradePrediction } from "./harness-trends.js";

// ── Sensor Fusion (v4) ─────────────────────────────────
export { fuseSensors, type DimensionScores, type SensorCluster } from "./sensor-fusion.js";

// ── Core Score ──────────────────────────────────────────
export {
  computeHarnessabilityScore,
  type HarnessabilityInput,
  type HarnessabilityResult,
  type DimensionBreakdown,
} from "./harnessability-score.js";

// ── Scan Runner ─────────────────────────────────────────
export {
  runHarnessScan,
  type HarnessScanResult,
} from "./harness-scan-runner.js";

// ── Preflight & Regression ──────────────────────────────
export {
  getHarnessPreflightWarning,
  getHarnessRegressionReport,
  type HarnessPreflightWarning,
  type HarnessRegressionReport,
} from "./harness-preflight.js";

// ── Issue Pattern Tracker ───────────────────────────────
export {
  IssuePatternTracker,
  type IssuePattern,
  type PatternStats,
  type RuleSuggestion,
} from "./issue-pattern-tracker.js";

// ── Scanners ────────────────────────────────────────────
export { scanTypeCoverage, type TypeCoverageResult, type FileContent } from "./type-coverage-scanner.js";
export { scanTestCoverage, type TestCoverageResult, type TestFileInfo } from "./test-coverage-scanner.js";
export { scanDocsCoverage, type DocsCoverageInput, type DocsCoverageResult } from "./docs-coverage-scanner.js";
export { scanNamingClarity, type NamingClarityResult } from "./naming-clarity-scanner.js";
export { scanErrorHandling, type ErrorHandlingResult } from "./error-handling-scanner.js";
export { scanContextDensity, type ContextDensityResult } from "./context-density-scanner.js";

// ── Cache ───────────────────────────────────────────────
export { runHarnessScanCached, resetHarnessCache } from "./harness-cache.js";

// ── Fitness Functions ───────────────────────────────────
export {
  checkDependencyDirection,
  checkCircularDependencies,
  checkBarrelIntegrity,
  type FitnessCheckResult,
  type Violation,
} from "./fitness-functions.js";
