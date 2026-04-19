/**
 * Barrel for the sandbox module (Wave-12 scaffolding).
 *
 * The full sandbox vision (env-checker, sandbox-cache, sandbox-fingerprint,
 * builder-executor, reporter) is planned but not yet implemented. This barrel
 * exposes only what exists today so the rest of the codebase can consume the
 * stable primitives without waiting for the full module.
 *
 * When the missing modules land, add their exports here and uncomment the
 * placeholder imports documented below:
 *   - ./env-checker.js        → EnvChecker, EnvCheckResult
 *   - ./sandbox-cache.js      → SandboxCache
 *   - ./sandbox-fingerprint.js → InputFingerprinter, CacheSkipResolver,
 *                               FingerprintedInput, ExecutionOutcome
 *   - ./builder-executor.js   → BuilderExecutor, BuilderConfig, BuilderResult
 *   - ./reporter.js           → parseTestResultsMultiFormat, integrateTestResults,
 *                               TestParseResult, ReportIntegrationInput,
 *                               ReportIntegrationResult, ReporterFormat
 */

export { FallbackResolver } from "./fallback-resolver.js";
export type { ToolAvailability, FallbackResult } from "./fallback-resolver.js";

// Wave-12: Functional Architecture Schemas (RAG-indexed)
export {
  SandboxBuilderConfigSchema,
  IsolationStrategySchema,
  SandboxCacheConfigSchema,
  BuilderExecutorConfigSchema,
  SandboxReportSchema,
  SandboxFunctionalArchitectureSchema,
  KeyConstraintsSchema,
  SANDBOX_ARCHITECTURE,
} from "./sandbox-architecture.js";
export type {
  SandboxBuilderConfig,
  IsolationStrategy,
  SandboxCacheConfig,
  BuilderExecutorConfig,
  SandboxReport,
  SandboxFunctionalArchitecture,
  KeyConstraints,
} from "./sandbox-architecture.js";
