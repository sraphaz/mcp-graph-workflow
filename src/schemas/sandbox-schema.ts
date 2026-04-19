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

import { z } from "zod/v4";

/**
 * Sandbox Build — Complete Type-Safe Schema Suite
 *
 * Covers all 4 layers:
 * - Layer 0: Input (BuilderConfig)
 * - Layer 1: Isolation (FallbackResolver, ToolAvailability)
 * - Layer 2: Cache (Fingerprint, SandboxCache)
 * - Layer 3: Execution (BuilderResult)
 * - Layer 4: Output (SandboxReport, TestResult)
 */

// ============================================================================
// Layer 0: Input Configuration
// ============================================================================

/**
 * Stack detection enum — auto-detected from project structure.
 *
 * Indicators:
 * - "maven": pom.xml present
 * - "gradle": build.gradle present
 * - "npm": package.json present
 * - "go": go.mod present
 * - "pip": requirements.txt present
 * - "auto": detect from files
 */
export const StackSchema = z.enum(["maven", "gradle", "npm", "go", "pip", "auto"]);
export type Stack = z.infer<typeof StackSchema>;

/**
 * Execution isolation mode with fallback chain.
 *
 * Fallback sequence (unless overridden):
 * 1. "docker": Reproducible containerized build (most accurate CI mirror)
 * 2. "podman": Rootless containerized build (fallback if Docker unavailable)
 * 3. "process": Native process isolation in temp directory (fastest)
 * 4. "auto": Use available in order (docker → podman → process)
 */
export const IsolationModeSchema = z.enum([
  "docker",
  "podman",
  "process",
  "auto",
]);
export type IsolationMode = z.infer<typeof IsolationModeSchema>;

/**
 * Execution profile — controls cache strategy and isolation level.
 *
 * - "ci-mirror": Docker with warm cache — validating pre-push with exact CI environment
 * - "fast": Process mode with hot cache — quick TDD iteration cycle
 * - "full": Docker with cold cache — reproducing CI failure from scratch
 */
export const ProfileSchema = z.enum(["ci-mirror", "fast", "full"]);
export type Profile = z.infer<typeof ProfileSchema>;

/**
 * Primary configuration for sandbox build execution.
 *
 * Contract: All paths must be absolute. Stack auto-detected if "auto".
 * Timeout is hard-enforced (no graceful shutdown).
 */
export const BuilderConfigSchema = z.object({
  projectDir: z
    .string()
    .min(1)
    .describe("Absolute path to project root"),

  isolatedDir: z
    .string()
    .min(1)
    .describe("Absolute path to temp directory for isolated execution"),

  stack: StackSchema.optional().default("auto").describe(
    "Build system: maven|gradle|npm|go|pip|auto (auto-detects from project)"
  ),

  command: z
    .string()
    .min(1)
    .describe("Build/test command to execute (e.g., 'npm test', 'mvn test')"),

  timeout: z
    .number()
    .int()
    .positive()
    .default(300000)
    .describe("Hard timeout in milliseconds (default 5 min)"),

  isolation: IsolationModeSchema.optional()
    .default("auto")
    .describe("Isolation mode: docker|podman|process|auto (falls back in order)"),

  profile: ProfileSchema.optional()
    .default("fast")
    .describe("Profile: ci-mirror (Docker), fast (Process), full (Docker clean)"),

  image: z
    .string()
    .optional()
    .describe(
      "Docker/Podman image URI (e.g., maven:3.9.0). If omitted, auto-select based on stack."
    ),

  cacheDir: z
    .string()
    .optional()
    .describe(
      "Custom cache directory. Defaults to ${projectDir}/.cache/sandbox-builder"
    ),
});

export type BuilderConfig = z.infer<typeof BuilderConfigSchema>;

// ============================================================================
// Layer 1: Isolation & Fallback Resolution
// ============================================================================

/**
 * Tool availability check result.
 *
 * Used to determine fallback chain at runtime.
 */
export const ToolAvailabilitySchema = z.object({
  docker: z.boolean().describe("Docker daemon available and runnable"),
  podman: z.boolean().describe("Podman available and runnable"),
  process: z.boolean().describe("Native process execution (always true)"),
});

export type ToolAvailability = z.infer<typeof ToolAvailabilitySchema>;

/**
 * Fallback resolution result — the mode actually selected after checking availability.
 */
export const FallbackResultSchema = z.object({
  executionMode: z.enum(["docker", "podman", "process"]).describe(
    "Mode selected after fallback resolution"
  ),

  reason: z
    .string()
    .describe("Human-readable explanation of why this mode was chosen"),

  fallbackChain: z
    .array(z.enum(["docker", "podman", "process"]))
    .describe("Modes that were attempted/considered in order"),

  allAvailable: ToolAvailabilitySchema.describe(
    "Availability of each tool at resolution time"
  ),
});

export type FallbackResult = z.infer<typeof FallbackResultSchema>;

// ============================================================================
// Layer 2: Cache & Fingerprinting
// ============================================================================

/**
 * Fingerprint input — all factors that affect build output reproducibility.
 *
 * Hash = SHA256(JSON.stringify(FingerprintInput))
 */
export const FingerprintInputSchema = z.object({
  stack: StackSchema,

  command: z.string().describe("Exact build/test command"),

  profile: ProfileSchema,

  dependencyFiles: z
    .record(z.string(), z.string())
    .describe("Key dependency files with mtime: { 'package.json': '1234567890' }"),

  runtimeVersion: z
    .string()
    .describe("Node/Java/Python version (e.g., 'v18.12.0')"),

  environment: z
    .record(z.string(), z.string())
    .optional()
    .describe("Relevant env vars that affect build (e.g., CI=true, NODE_ENV)"),
});

export type FingerprintInput = z.infer<typeof FingerprintInputSchema>;

/**
 * Fingerprint result — SHA256 hash and metadata.
 */
export const FingerprintResultSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/).describe("SHA256 hash (64 hex chars)"),

  input: FingerprintInputSchema.describe("Inputs that produced this hash"),

  timestamp: z.string().datetime().describe("When fingerprint was computed"),
});

export type FingerprintResult = z.infer<typeof FingerprintResultSchema>;

/**
 * Cache entry — stored as ${hash}.json in cache directory.
 */
export const CacheEntrySchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  result: z.unknown().describe("Cached BuilderResult"),
  storedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type CacheEntry = z.infer<typeof CacheEntrySchema>;

// ============================================================================
// Layer 3: Execution Result
// ============================================================================

/**
 * Build execution status.
 *
 * - "success": Exit code 0, all tests passed
 * - "failure": Exit code non-zero or tests failed
 * - "timeout": Exceeded configured timeout (hard kill applied)
 * - "error": Setup/system error (isolation failed, etc.)
 */
export const ExecutionStatusSchema = z.enum([
  "success",
  "failure",
  "timeout",
  "error",
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

/**
 * Complete build/test execution result.
 *
 * This is what's returned from BuilderExecutor.execute() and stored in cache.
 */
export const BuilderResultSchema = z.object({
  success: z.boolean().describe("true if build succeeded, false otherwise"),

  status: ExecutionStatusSchema.describe("Detailed execution outcome"),

  executionMode: z
    .enum(["docker", "podman", "process"])
    .describe("Actual mode used (after fallback resolution)"),

  command: z.string().describe("Executed command"),

  profile: ProfileSchema.describe("Profile used"),

  durationMs: z
    .number()
    .int()
    .nonnegative()
    .describe("Total execution time in milliseconds"),

  exitCode: z
    .number()
    .int()
    .optional()
    .describe("Process exit code (0 = success)"),

  output: z
    .string()
    .describe("Combined stdout + stderr output"),

  stderr: z.string().optional().describe("Separate stderr if captured"),

  timestamp: z.string().datetime().describe("ISO 8601 execution timestamp"),

  isolatedDir: z
    .string()
    .describe("Absolute path to isolated directory used"),

  cacheKey: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .describe("SHA256 fingerprint that produced this result"),

  cacheHit: z
    .boolean()
    .describe("true if result was retrieved from cache without execution"),

  fallbackChain: z
    .array(z.enum(["docker", "podman", "process"]))
    .optional()
    .describe("Isolation modes attempted before success"),

  timeout: z
    .boolean()
    .default(false)
    .describe("true if execution was hard-killed due to timeout"),
});

export type BuilderResult = z.infer<typeof BuilderResultSchema>;

// ============================================================================
// Layer 4: Output & Test Result Parsing
// ============================================================================

/**
 * Supported test report formats.
 *
 * - "surefire": Maven Surefire XML (target/surefire-reports/*.xml)
 * - "junit": JUnit XML (Gradle, etc.)
 * - "jest": Jest JSON report (npm projects)
 * - "go-test": Go test output (stdout/stderr)
 * - "unknown": Format not detected
 */
export const TestFormatSchema = z.enum([
  "surefire",
  "junit",
  "jest",
  "go-test",
  "unknown",
]);
export type TestFormat = z.infer<typeof TestFormatSchema>;

/**
 * Single failed test with details.
 */
export const FailedTestSchema = z.object({
  name: z.string().describe("Test name (e.g., 'com.example.MyTest::testFoo')"),

  file: z.string().describe("Source file path (relative or absolute)"),

  stackTrace: z
    .string()
    .describe("Full exception/assertion stack trace from test output"),

  duration: z.number().optional().describe("Test duration in milliseconds"),
});

export type FailedTest = z.infer<typeof FailedTestSchema>;

/**
 * Parsed test result metrics extracted from build output.
 *
 * Source: Surefire XML, JUnit XML, Jest JSON, or Go test output.
 */
export const TestResultSchema = z.object({
  format: TestFormatSchema.describe("Detected test report format"),

  totalTests: z.number().int().nonnegative().describe("Total tests run"),

  passed: z.number().int().nonnegative().describe("Tests passed"),

  failed: z.number().int().nonnegative().describe("Tests failed"),

  skipped: z.number().int().nonnegative().describe("Tests skipped"),

  duration: z
    .number()
    .int()
    .optional()
    .describe("Total test execution time in milliseconds"),

  failedTests: z
    .array(FailedTestSchema)
    .describe("List of failed tests with stack traces"),

  reportPath: z
    .string()
    .optional()
    .describe("Path to original test report file"),
});

export type TestResult = z.infer<typeof TestResultSchema>;

/**
 * Quality gate evaluation result.
 *
 * Used when running constitution checks and code quality gates.
 */
export const QualityGateSchema = z.object({
  name: z
    .string()
    .describe("Gate name (e.g., 'yaml-no-duplicate-keys', 'security_scan')"),

  passed: z.boolean().describe("Gate result"),

  reason: z
    .string()
    .optional()
    .describe("Explanation if failed"),

  evidence: z
    .unknown()
    .optional()
    .describe("Structured evidence (e.g., failed rules list)"),
});

export type QualityGate = z.infer<typeof QualityGateSchema>;

/**
 * Complete sandbox validation report — everything needed to update graph and decide next steps.
 *
 * This is what finish_task receives when updateGraph=true.
 */
export const SandboxReportSchema = z.object({
  nodeId: z.string().describe("Graph node ID being validated"),

  sandboxResult: BuilderResultSchema.describe("Raw BuilderResult from execution"),

  testsParsed: TestResultSchema.optional().describe(
    "Parsed test metrics (if tests were run)"
  ),

  qualityGates: z
    .array(QualityGateSchema)
    .optional()
    .describe("Constitution checks and quality gates evaluated"),

  graphUpdate: z
    .object({
      nodeId: z.string(),
      newStatus: z.enum(["blocked", "in_progress", "ready"]),
      rationale: z.string().describe("Reason for status change"),
      metadata: z.unknown().optional(),
    })
    .optional()
    .describe("Graph update that was/will be applied"),

  blockReason: z
    .string()
    .optional()
    .describe(
      "If sandbox failed and node is blocked, this explains why (test failure, timeout, etc.)"
    ),

  timestamp: z.string().datetime(),
});

export type SandboxReport = z.infer<typeof SandboxReportSchema>;

// ============================================================================
// Stack Detection
// ============================================================================

/**
 * Indicator file for each build system.
 */
export const StackIndicatorSchema = z.object({
  file: z
    .string()
    .describe("Indicator file name (e.g., 'pom.xml', 'package.json')"),

  detected: z.boolean().describe("true if file exists in project"),
});

export type StackIndicator = z.infer<typeof StackIndicatorSchema>;

/**
 * Stack detection result with confidence and indicators checked.
 */
export const StackDetectionResultSchema = z.object({
  stack: StackSchema.describe("Detected or best-guess stack type"),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Confidence score (1.0 = certain, 0.0 = complete guess, 0.5+ = reasonable confidence)"
    ),

  indicators: z
    .array(StackIndicatorSchema)
    .describe("Files checked to reach this detection"),

  recommendation: z
    .string()
    .optional()
    .describe("Human-readable explanation or recommendation"),
});

export type StackDetectionResult = z.infer<typeof StackDetectionResultSchema>;

// ============================================================================
// Errors & Constraints (Optional, for documentation)
// ============================================================================

/**
 * Constraint validation result — used to enforce rules before execution.
 */
export const ConstraintCheckSchema = z.object({
  name: z
    .string()
    .describe(
      "Constraint name (e.g., 'no-cross-test-pollution', 'timeout-enforced')"
    ),

  passed: z.boolean(),

  message: z.string().optional().describe("If failed, explanation of violation"),
});

export type ConstraintCheck = z.infer<typeof ConstraintCheckSchema>;

// ============================================================================
// Re-exports for convenience
// ============================================================================

export const SandboxSchemaSuite = {
  // Layer 0
  Stack: StackSchema,
  IsolationMode: IsolationModeSchema,
  Profile: ProfileSchema,
  BuilderConfig: BuilderConfigSchema,

  // Layer 1
  ToolAvailability: ToolAvailabilitySchema,
  FallbackResult: FallbackResultSchema,

  // Layer 2
  FingerprintInput: FingerprintInputSchema,
  FingerprintResult: FingerprintResultSchema,
  CacheEntry: CacheEntrySchema,

  // Layer 3
  ExecutionStatus: ExecutionStatusSchema,
  BuilderResult: BuilderResultSchema,

  // Layer 4
  TestFormat: TestFormatSchema,
  FailedTest: FailedTestSchema,
  TestResult: TestResultSchema,
  QualityGate: QualityGateSchema,
  SandboxReport: SandboxReportSchema,
  StackDetectionResult: StackDetectionResultSchema,
  ConstraintCheck: ConstraintCheckSchema,
};

export type SandboxSchemas = typeof SandboxSchemaSuite;
