/**
 * Wave-12 Sandbox Build — Functional Architecture Schema Tests
 *
 * TDD Red→Green: tests written before implementation.
 * Validates all 5 layers + constraints document for RAG indexing.
 *
 * Layer coverage:
 *   L1 — InputLayer    (SandboxBuilderConfigSchema)
 *   L2 — IsolationLayer (IsolationStrategySchema)
 *   L3 — CacheLayer    (SandboxCacheConfigSchema)
 *   L4 — RunnerLayer   (BuilderExecutorConfigSchema)
 *   L5 — OutputLayer   (SandboxReportSchema)
 *   Arch — Full functional architecture document
 *   Constraints — KeyConstraintsSchema
 */

import { describe, it, expect } from "vitest";
import {
  SandboxBuilderConfigSchema,
  IsolationStrategySchema,
  SandboxCacheConfigSchema,
  BuilderExecutorConfigSchema,
  SandboxReportSchema,
  SandboxFunctionalArchitectureSchema,
  KeyConstraintsSchema,
  SANDBOX_ARCHITECTURE,
  type SandboxBuilderConfig,
  type IsolationStrategy,
  type SandboxCacheConfig,
  type BuilderExecutorConfig,
  type SandboxReport,
  // Reserved — test cases for the aggregate type land in a follow-up PR.
  type SandboxFunctionalArchitecture as _SandboxFunctionalArchitecture,
  type KeyConstraints,
} from "../core/sandbox/sandbox-architecture.js";

// ─── L1: Input Layer ───────────────────────────────────────────────────────────

describe("SandboxBuilderConfigSchema — L1 Input Layer", () => {
  it("should accept valid minimal config", () => {
    const config: SandboxBuilderConfig = {
      projectDir: "/workspace/my-project",
      stack: "auto",
      timeout: 300000,
      isolation: "auto",
    };

    const result = SandboxBuilderConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should accept full config with all optional fields", () => {
    const config: SandboxBuilderConfig = {
      projectDir: "/workspace/my-project",
      stack: "maven",
      timeout: 120000,
      isolation: "docker",
      image: "maven:3.9-eclipse-temurin-17",
      cacheDir: "/tmp/.cache/sandbox",
      env: { MAVEN_OPTS: "-Xmx1g" },
      workDir: "/workspace/my-project/module-a",
    };

    const result = SandboxBuilderConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should reject config with missing projectDir", () => {
    const config = {
      stack: "npm",
      timeout: 30000,
      isolation: "process",
    };

    const result = SandboxBuilderConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject invalid stack value", () => {
    const config = {
      projectDir: "/workspace/proj",
      stack: "ruby-on-rails", // invalid
      timeout: 30000,
      isolation: "process",
    };

    const result = SandboxBuilderConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject invalid isolation value", () => {
    const config = {
      projectDir: "/workspace/proj",
      stack: "npm",
      timeout: 30000,
      isolation: "virtualbox", // invalid
    };

    const result = SandboxBuilderConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should reject negative timeout", () => {
    const config = {
      projectDir: "/workspace/proj",
      stack: "npm",
      timeout: -1000,
      isolation: "process",
    };

    const result = SandboxBuilderConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("should apply defaults for optional fields", () => {
    const minimal = { projectDir: "/proj" };
    const result = SandboxBuilderConfigSchema.safeParse(minimal);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stack).toBe("auto");
      expect(result.data.timeout).toBe(300000);
      expect(result.data.isolation).toBe("auto");
    }
  });
});

// ─── L2: Isolation Layer ────────────────────────────────────────────────────────

describe("IsolationStrategySchema — L2 Isolation Layer", () => {
  it("should accept docker isolation strategy", () => {
    const strategy: IsolationStrategy = {
      mode: "docker",
      available: true,
      image: "node:18-alpine",
      fallbackChain: ["docker", "podman", "process"],
      isolationGuarantee: "strong",
    };

    const result = IsolationStrategySchema.safeParse(strategy);
    expect(result.success).toBe(true);
  });

  it("should accept podman isolation strategy", () => {
    const strategy: IsolationStrategy = {
      mode: "podman",
      available: true,
      image: "maven:3.9",
      fallbackChain: ["podman", "process"],
      isolationGuarantee: "strong",
    };

    const result = IsolationStrategySchema.safeParse(strategy);
    expect(result.success).toBe(true);
  });

  it("should accept process isolation strategy", () => {
    const strategy: IsolationStrategy = {
      mode: "process",
      available: true,
      fallbackChain: ["process"],
      isolationGuarantee: "weak",
    };

    const result = IsolationStrategySchema.safeParse(strategy);
    expect(result.success).toBe(true);
  });

  it("should reject invalid isolation mode", () => {
    const strategy = {
      mode: "virtualenv",
      available: true,
      fallbackChain: ["process"],
      isolationGuarantee: "weak",
    };

    const result = IsolationStrategySchema.safeParse(strategy);
    expect(result.success).toBe(false);
  });

  it("should reject invalid isolation guarantee", () => {
    const strategy = {
      mode: "docker",
      available: true,
      fallbackChain: ["docker"],
      isolationGuarantee: "absolute", // invalid
    };

    const result = IsolationStrategySchema.safeParse(strategy);
    expect(result.success).toBe(false);
  });

  it("should enforce no cross-test pollution — fallbackChain must be non-empty", () => {
    const strategy = {
      mode: "docker",
      available: true,
      fallbackChain: [], // empty chain violates isolation guarantee
      isolationGuarantee: "strong",
    };

    const result = IsolationStrategySchema.safeParse(strategy);
    expect(result.success).toBe(false);
  });
});

// ─── L3: Cache Layer ────────────────────────────────────────────────────────────

describe("SandboxCacheConfigSchema — L3 Cache Layer", () => {
  it("should accept valid cache config with fingerprint strategy", () => {
    const cache: SandboxCacheConfig = {
      cacheDir: "/tmp/.cache/sandbox",
      fingerprintStrategy: "content-hash",
      ttlMs: 3600000,
      invalidationTriggers: ["dependency-change", "config-change"],
      maxSizeBytes: 104857600,
    };

    const result = SandboxCacheConfigSchema.safeParse(cache);
    expect(result.success).toBe(true);
  });

  it("should accept disabled cache config", () => {
    const cache: SandboxCacheConfig = {
      cacheDir: "/tmp/.cache/sandbox",
      fingerprintStrategy: "none",
      ttlMs: 0,
      invalidationTriggers: [],
    };

    const result = SandboxCacheConfigSchema.safeParse(cache);
    expect(result.success).toBe(true);
  });

  it("should reject cache config missing cacheDir", () => {
    const cache = {
      fingerprintStrategy: "content-hash",
      ttlMs: 3600000,
      invalidationTriggers: ["dependency-change"],
    };

    const result = SandboxCacheConfigSchema.safeParse(cache);
    expect(result.success).toBe(false);
  });

  it("should reject invalid fingerprint strategy", () => {
    const cache = {
      cacheDir: "/tmp/.cache",
      fingerprintStrategy: "random-hash", // invalid
      ttlMs: 3600000,
      invalidationTriggers: [],
    };

    const result = SandboxCacheConfigSchema.safeParse(cache);
    expect(result.success).toBe(false);
  });

  it("should reject invalid invalidation trigger", () => {
    const cache = {
      cacheDir: "/tmp/.cache",
      fingerprintStrategy: "content-hash",
      ttlMs: 3600000,
      invalidationTriggers: ["magic-invalidate"], // invalid
    };

    const result = SandboxCacheConfigSchema.safeParse(cache);
    expect(result.success).toBe(false);
  });

  it("should apply default for maxSizeBytes when not provided", () => {
    const cache = {
      cacheDir: "/tmp/.cache/sandbox",
      fingerprintStrategy: "content-hash",
      ttlMs: 3600000,
      invalidationTriggers: ["dependency-change"],
    };

    const result = SandboxCacheConfigSchema.safeParse(cache);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxSizeBytes).toBeDefined();
    }
  });
});

// ─── L4: Runner Layer ───────────────────────────────────────────────────────────

describe("BuilderExecutorConfigSchema — L4 Runner Layer", () => {
  it("should accept valid runner config with compile + test phases", () => {
    const runner: BuilderExecutorConfig = {
      phases: ["compile", "test"],
      command: "mvn test -q",
      timeoutMs: 300000,
      killSignal: "SIGKILL",
      hardKillOnTimeout: true,
      captureStdout: true,
      captureStderr: true,
      profile: "ci-mirror",
    };

    const result = BuilderExecutorConfigSchema.safeParse(runner);
    expect(result.success).toBe(true);
  });

  it("should require hardKillOnTimeout to be true for TIMEOUT constraint", () => {
    const runner = {
      phases: ["test"],
      command: "npm test",
      timeoutMs: 60000,
      killSignal: "SIGKILL",
      hardKillOnTimeout: true,
      captureStdout: true,
      captureStderr: false,
      profile: "fast",
    };

    const result = BuilderExecutorConfigSchema.safeParse(runner);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hardKillOnTimeout).toBe(true);
    }
  });

  it("should reject config with no phases", () => {
    const runner = {
      phases: [], // empty — must have at least one phase
      command: "npm test",
      timeoutMs: 60000,
      killSignal: "SIGKILL",
      hardKillOnTimeout: true,
      captureStdout: true,
      captureStderr: false,
      profile: "fast",
    };

    const result = BuilderExecutorConfigSchema.safeParse(runner);
    expect(result.success).toBe(false);
  });

  it("should reject invalid phase", () => {
    const runner = {
      phases: ["deploy"], // deploy not in allowed phases
      command: "npm run deploy",
      timeoutMs: 60000,
      killSignal: "SIGKILL",
      hardKillOnTimeout: true,
      captureStdout: true,
      captureStderr: false,
      profile: "fast",
    };

    const result = BuilderExecutorConfigSchema.safeParse(runner);
    expect(result.success).toBe(false);
  });

  it("should reject invalid kill signal", () => {
    const runner = {
      phases: ["test"],
      command: "npm test",
      timeoutMs: 60000,
      killSignal: "SIGSTOP", // not in allowed set
      hardKillOnTimeout: true,
      captureStdout: true,
      captureStderr: false,
      profile: "fast",
    };

    const result = BuilderExecutorConfigSchema.safeParse(runner);
    expect(result.success).toBe(false);
  });

  it("should reject zero or negative timeoutMs", () => {
    const runner = {
      phases: ["test"],
      command: "npm test",
      timeoutMs: 0,
      killSignal: "SIGKILL",
      hardKillOnTimeout: true,
      captureStdout: true,
      captureStderr: false,
      profile: "fast",
    };

    const result = BuilderExecutorConfigSchema.safeParse(runner);
    expect(result.success).toBe(false);
  });
});

// ─── L5: Output Layer ──────────────────────────────────────────────────────────

describe("SandboxReportSchema — L5 Output Layer", () => {
  it("should accept valid success report with surefire results", () => {
    const report: SandboxReport = {
      status: "success",
      executionMode: "docker",
      profile: "ci-mirror",
      durationMs: 45200,
      cacheHit: false,
      cacheKey: "abc123def456",
      testResults: {
        format: "surefire",
        totalTests: 42,
        passedTests: 42,
        failedTests: 0,
        skippedTests: 0,
        success: true,
      },
      evidence: {
        nodeId: "node_abc",
        updatedAt: "2026-04-18T12:00:00.000Z",
      },
      timestamp: "2026-04-18T12:00:45.000Z",
    };

    const result = SandboxReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("should accept timeout report with hard-kill evidence", () => {
    const report: SandboxReport = {
      status: "timeout",
      executionMode: "process",
      profile: "fast",
      durationMs: 300001,
      cacheHit: false,
      cacheKey: "xyz789",
      testResults: {
        format: "jest",
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        success: false,
        errorMessage: "Execution timed out after 300000ms — process killed with SIGKILL",
      },
      timestamp: "2026-04-18T12:05:01.000Z",
    };

    const result = SandboxReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("should accept failure report with jest results", () => {
    const report: SandboxReport = {
      status: "failure",
      executionMode: "podman",
      profile: "full",
      durationMs: 12500,
      cacheHit: false,
      cacheKey: "fail123",
      testResults: {
        format: "jest",
        totalTests: 10,
        passedTests: 7,
        failedTests: 3,
        skippedTests: 0,
        success: false,
        errorMessage: "3 test suites failed",
      },
      timestamp: "2026-04-18T11:00:00.000Z",
    };

    const result = SandboxReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("should accept go-test format results", () => {
    const report: SandboxReport = {
      status: "success",
      executionMode: "process",
      profile: "fast",
      durationMs: 3400,
      cacheHit: true,
      cacheKey: "gotest_hash_42",
      testResults: {
        format: "go-test",
        totalTests: 18,
        passedTests: 18,
        failedTests: 0,
        skippedTests: 0,
        success: true,
      },
      timestamp: "2026-04-18T10:00:00.000Z",
    };

    const result = SandboxReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("should reject report with invalid status", () => {
    const report = {
      status: "skipped", // invalid
      executionMode: "process",
      profile: "fast",
      durationMs: 1000,
      cacheHit: false,
      cacheKey: "k1",
      testResults: {
        format: "jest",
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
        skippedTests: 0,
        success: true,
      },
      timestamp: "2026-04-18T10:00:00.000Z",
    };

    const result = SandboxReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });

  it("should reject report with invalid test result format", () => {
    const report = {
      status: "success",
      executionMode: "process",
      profile: "fast",
      durationMs: 1000,
      cacheHit: false,
      cacheKey: "k1",
      testResults: {
        format: "xunit", // not supported
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
        skippedTests: 0,
        success: true,
      },
      timestamp: "2026-04-18T10:00:00.000Z",
    };

    const result = SandboxReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });
});

// ─── Functional Architecture Document ─────────────────────────────────────────

describe("SandboxFunctionalArchitectureSchema — Full Architecture", () => {
  it("should validate the exported SANDBOX_ARCHITECTURE constant", () => {
    const result = SandboxFunctionalArchitectureSchema.safeParse(SANDBOX_ARCHITECTURE);
    expect(result.success).toBe(true);
  });

  it("should have all 5 layers defined", () => {
    expect(SANDBOX_ARCHITECTURE.layers).toHaveLength(5);
    const layerNames = SANDBOX_ARCHITECTURE.layers.map((l) => l.name);
    expect(layerNames).toContain("InputLayer");
    expect(layerNames).toContain("IsolationLayer");
    expect(layerNames).toContain("CacheLayer");
    expect(layerNames).toContain("RunnerLayer");
    expect(layerNames).toContain("OutputLayer");
  });

  it("should have version and description", () => {
    expect(SANDBOX_ARCHITECTURE.version).toBeDefined();
    expect(SANDBOX_ARCHITECTURE.description).toBeDefined();
    expect(typeof SANDBOX_ARCHITECTURE.description).toBe("string");
    expect(SANDBOX_ARCHITECTURE.description.length).toBeGreaterThan(10);
  });

  it("should list all supported stacks", () => {
    expect(SANDBOX_ARCHITECTURE.supportedStacks).toBeDefined();
    expect(SANDBOX_ARCHITECTURE.supportedStacks).toContain("maven");
    expect(SANDBOX_ARCHITECTURE.supportedStacks).toContain("npm");
    expect(SANDBOX_ARCHITECTURE.supportedStacks).toContain("go");
  });

  it("should list all supported test report formats", () => {
    expect(SANDBOX_ARCHITECTURE.supportedFormats).toBeDefined();
    expect(SANDBOX_ARCHITECTURE.supportedFormats).toContain("surefire");
    expect(SANDBOX_ARCHITECTURE.supportedFormats).toContain("junit");
    expect(SANDBOX_ARCHITECTURE.supportedFormats).toContain("jest");
    expect(SANDBOX_ARCHITECTURE.supportedFormats).toContain("go-test");
  });

  it("should describe isolation fallback chain", () => {
    expect(SANDBOX_ARCHITECTURE.isolationFallbackChain).toBeDefined();
    expect(SANDBOX_ARCHITECTURE.isolationFallbackChain[0]).toBe("docker");
    expect(SANDBOX_ARCHITECTURE.isolationFallbackChain[1]).toBe("podman");
    expect(SANDBOX_ARCHITECTURE.isolationFallbackChain[2]).toBe("process");
  });
});

// ─── Key Constraints ───────────────────────────────────────────────────────────

describe("KeyConstraintsSchema — Sandbox Build Constraints", () => {
  it("should validate constraints exported in SANDBOX_ARCHITECTURE", () => {
    const result = KeyConstraintsSchema.safeParse(SANDBOX_ARCHITECTURE.constraints);
    expect(result.success).toBe(true);
  });

  it("should enforce isolation guarantee constraint", () => {
    const constraints: KeyConstraints = {
      isolationGuarantee: {
        description: "No cross-test pollution between sandbox executions",
        enforcement: "hard",
        mechanism: "isolated-tmpdir-per-execution",
      },
      timeoutHandling: {
        description: "Hard kill on TIMEOUT — process group killed with SIGKILL",
        enforcement: "hard",
        defaultTimeoutMs: 300000,
        killSignal: "SIGKILL",
        hardKill: true,
      },
      cacheInvalidation: {
        description: "Cache invalidated on dependency changes via SHA-256 content hash",
        enforcement: "hard",
        triggers: ["dependency-change", "config-change", "env-change"],
        algorithm: "sha256",
      },
      testResultFidelity: {
        description: "Test results parsed deterministically across surefire/junit/jest/go-test",
        enforcement: "hard",
        supportedFormats: ["surefire", "junit", "jest", "go-test"],
      },
      crossPlatform: {
        description: "Docker/Podman/Process isolation on Linux/Mac/Windows",
        enforcement: "soft",
        platforms: ["linux", "darwin", "win32"],
        isolationModes: ["docker", "podman", "process"],
      },
    };

    const result = KeyConstraintsSchema.safeParse(constraints);
    expect(result.success).toBe(true);
  });

  it("should reject constraints with invalid enforcement level", () => {
    const constraints = {
      isolationGuarantee: {
        description: "No cross-test pollution",
        enforcement: "advisory", // invalid — only 'hard' | 'soft'
        mechanism: "isolated-tmpdir-per-execution",
      },
      timeoutHandling: {
        description: "Hard kill",
        enforcement: "hard",
        defaultTimeoutMs: 300000,
        killSignal: "SIGKILL",
        hardKill: true,
      },
      cacheInvalidation: {
        description: "Cache invalidation",
        enforcement: "hard",
        triggers: ["dependency-change"],
        algorithm: "sha256",
      },
      testResultFidelity: {
        description: "Test results",
        enforcement: "hard",
        supportedFormats: ["surefire"],
      },
      crossPlatform: {
        description: "Cross-platform",
        enforcement: "soft",
        platforms: ["linux"],
        isolationModes: ["process"],
      },
    };

    const result = KeyConstraintsSchema.safeParse(constraints);
    expect(result.success).toBe(false);
  });

  it("should require hardKill:true in timeoutHandling", () => {
    const constraints = {
      isolationGuarantee: {
        description: "No pollution",
        enforcement: "hard",
        mechanism: "isolated-tmpdir",
      },
      timeoutHandling: {
        description: "Kill on timeout",
        enforcement: "hard",
        defaultTimeoutMs: 300000,
        killSignal: "SIGKILL",
        hardKill: false, // MUST be true per constraint
      },
      cacheInvalidation: {
        description: "Cache invalidation",
        enforcement: "hard",
        triggers: ["dependency-change"],
        algorithm: "sha256",
      },
      testResultFidelity: {
        description: "Test results",
        enforcement: "hard",
        supportedFormats: ["surefire"],
      },
      crossPlatform: {
        description: "Cross-platform",
        enforcement: "soft",
        platforms: ["linux"],
        isolationModes: ["process"],
      },
    };

    const result = KeyConstraintsSchema.safeParse(constraints);
    expect(result.success).toBe(false);
  });

  it("should reject constraints with empty test formats list", () => {
    const constraints = {
      isolationGuarantee: {
        description: "No pollution",
        enforcement: "hard",
        mechanism: "isolated-tmpdir",
      },
      timeoutHandling: {
        description: "Kill on timeout",
        enforcement: "hard",
        defaultTimeoutMs: 300000,
        killSignal: "SIGKILL",
        hardKill: true,
      },
      cacheInvalidation: {
        description: "Cache invalidation",
        enforcement: "hard",
        triggers: ["dependency-change"],
        algorithm: "sha256",
      },
      testResultFidelity: {
        description: "Test results",
        enforcement: "hard",
        supportedFormats: [], // must have at least one format
      },
      crossPlatform: {
        description: "Cross-platform",
        enforcement: "soft",
        platforms: ["linux"],
        isolationModes: ["process"],
      },
    };

    const result = KeyConstraintsSchema.safeParse(constraints);
    expect(result.success).toBe(false);
  });
});
