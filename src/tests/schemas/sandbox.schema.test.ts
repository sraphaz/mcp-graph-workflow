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

import { describe, it, expect } from "vitest";
import {
  // Stack & Isolation Types
  StackTypeSchema,
  IsolationModeSchema,
  // Reserved — test cases for these schemas will land in a follow-up PR.
  // Prefixed with `_` to satisfy the unused-var rule while keeping the
  // barrel import self-documenting.
  ExecutionProfileSchema as _ExecutionProfileSchema,
  TestFormatSchema as _TestFormatSchema,
  // Inputs
  SandboxBuildInputSchema,
  EnvRequirementsSchema,
  SandboxConfigValidationSchema,
  ReportIntegrationInputSchema,
  // Outputs
  BuildResultSchema,
  EnvCheckResultSchema,
  ValidationResultSchema,
  ReportIntegrationResultSchema,
  TestParseResultSchema,
  TestSummarySchema,
  FailedTestEntrySchema,
  // Union types
  SandboxToolInputSchema,
  SandboxToolOutputSchema,
} from "../../schemas/sandbox.schema.js";

describe("Sandbox Build API Schemas", () => {
  // ── Stack & Isolation ──

  describe("StackTypeSchema", () => {
    it("should accept valid stack types", () => {
      expect(StackTypeSchema.parse("maven")).toBe("maven");
      expect(StackTypeSchema.parse("npm")).toBe("npm");
      expect(StackTypeSchema.parse("auto")).toBe("auto");
    });

    it("should reject invalid stack types", () => {
      expect(() => StackTypeSchema.parse("rust")).toThrow();
    });
  });

  describe("IsolationModeSchema", () => {
    it("should accept valid isolation modes", () => {
      expect(IsolationModeSchema.parse("docker")).toBe("docker");
      expect(IsolationModeSchema.parse("podman")).toBe("podman");
      expect(IsolationModeSchema.parse("process")).toBe("process");
    });

    it("should reject invalid isolation modes", () => {
      expect(() => IsolationModeSchema.parse("kubernetes")).toThrow();
    });
  });

  // ── SandboxBuildInput ──

  describe("SandboxBuildInputSchema", () => {
    it("should accept minimal build input", () => {
      const input = {
        projectDir: "/home/user/project",
      };
      const result = SandboxBuildInputSchema.parse(input);
      expect(result.projectDir).toBe("/home/user/project");
      expect(result.stack).toBe("auto");
      expect(result.isolation).toBe("auto");
      expect(result.profile).toBe("fast");
      expect(result.timeout).toBe(300000);
    });

    it("should accept full build input with custom settings", () => {
      const input = {
        projectDir: "/home/user/project",
        stack: "maven" as const,
        isolation: "docker" as const,
        profile: "ci-mirror" as const,
        command: "mvn test -f pom-coverage.xml",
        image: "maven:3.9.0-eclipse-temurin-18",
        timeout: 600000,
        parallel: true,
        testFilter: "com.example.*.Test",
        credentials: {
          MAVEN_GPG_PASSPHRASE: "secret",
          NPM_TOKEN: "npm_token_123",
        },
      };
      const result = SandboxBuildInputSchema.parse(input);
      expect(result.stack).toBe("maven");
      expect(result.parallel).toBe(true);
      expect(result.credentials?.MAVEN_GPG_PASSPHRASE).toBe("secret");
    });

    it("should reject negative timeout", () => {
      expect(() =>
        SandboxBuildInputSchema.parse({
          projectDir: "/home/user/project",
          timeout: -1,
        }),
      ).toThrow();
    });

    it("should reject missing projectDir", () => {
      expect(() => SandboxBuildInputSchema.parse({})).toThrow();
    });
  });

  // ── BuildResult ──

  describe("BuildResultSchema", () => {
    it("should accept successful build result", () => {
      const result = {
        success: true,
        status: "success" as const,
        executionMode: "docker" as const,
        profile: "ci-mirror" as const,
        command: "mvn test -f pom-coverage.xml",
        stack: "maven" as const,
        durationMs: 45000,
        output: "BUILD SUCCESS\n",
        timestamp: "2026-04-18T18:40:08.403Z",
        isolatedDir: "/tmp/sandbox-abc123",
        cacheKey: "sha256:abc123",
        cacheHit: false,
      };
      const parsed = BuildResultSchema.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.status).toBe("success");
      expect(parsed.durationMs).toBe(45000);
    });

    it("should accept failed build result with stderr", () => {
      const result = {
        success: false,
        status: "failure" as const,
        executionMode: "process" as const,
        profile: "fast" as const,
        command: "npm test",
        stack: "npm" as const,
        durationMs: 12000,
        exitCode: 1,
        output: "FAIL src/__tests__/foo.test.ts",
        stderr: "ERR! Test suite failed\n",
        timestamp: "2026-04-18T18:40:08.403Z",
        isolatedDir: "/tmp/sandbox-def456",
        cacheKey: "sha256:def456",
        cacheHit: false,
      };
      const parsed = BuildResultSchema.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.exitCode).toBe(1);
      expect(parsed.stderr).toBeDefined();
    });

    it("should accept build result with fallback chain", () => {
      const result = {
        success: true,
        status: "success" as const,
        executionMode: "podman" as const,
        profile: "fast" as const,
        command: "mvn test",
        stack: "maven" as const,
        durationMs: 30000,
        output: "BUILD SUCCESS",
        timestamp: "2026-04-18T18:40:08.403Z",
        isolatedDir: "/tmp/sandbox-xyz",
        cacheKey: "sha256:xyz",
        cacheHit: false,
        fallbackChain: ["docker", "podman", "process"] as const[],
        warnings: ["Docker fallback to Podman"],
      };
      const parsed = BuildResultSchema.parse(result);
      expect(parsed.fallbackChain).toEqual(["docker", "podman", "process"]);
    });

    it("should accept cached build result", () => {
      const result = {
        success: true,
        status: "success" as const,
        executionMode: "process" as const,
        profile: "fast" as const,
        command: "mvn test",
        stack: "maven" as const,
        durationMs: 1000, // Much faster
        output: "BUILD SUCCESS (cached)",
        timestamp: "2026-04-18T18:50:00.000Z",
        isolatedDir: "/tmp/sandbox-cached",
        cacheKey: "sha256:previous",
        cacheHit: true,
      };
      const parsed = BuildResultSchema.parse(result);
      expect(parsed.cacheHit).toBe(true);
    });
  });

  // ── TestSummary & TestParseResult ──

  describe("TestSummarySchema", () => {
    it("should accept test summary with all metrics", () => {
      const summary = {
        totalTests: 25,
        passedTests: 23,
        failedTests: 2,
        skippedTests: 0,
        durationMs: 5000,
      };
      const parsed = TestSummarySchema.parse(summary);
      expect(parsed.totalTests).toBe(25);
      expect(parsed.passedTests).toBe(23);
    });

    it("should require non-negative test counts", () => {
      expect(() =>
        TestSummarySchema.parse({
          totalTests: -1,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
        }),
      ).toThrow();
    });
  });

  describe("FailedTestEntrySchema", () => {
    it("should accept failed test entry", () => {
      const entry = {
        name: "com.example.MyTest",
        testMethod: "shouldValidateInput",
        message: "Expected 10 but got 5",
        stackTrace: "java.lang.AssertionError: ...",
      };
      const parsed = FailedTestEntrySchema.parse(entry);
      expect(parsed.name).toBe("com.example.MyTest");
    });
  });

  describe("TestParseResultSchema", () => {
    it("should accept successful test parse result", () => {
      const result = {
        success: true,
        format: "surefire" as const,
        summary: {
          totalTests: 25,
          passedTests: 25,
          failedTests: 0,
          skippedTests: 0,
          durationMs: 5000,
        },
        timestamp: "2026-04-18T18:40:08.403Z",
      };
      const parsed = TestParseResultSchema.parse(result);
      expect(parsed.success).toBe(true);
    });

    it("should accept failed test parse result with failures", () => {
      const result = {
        success: false,
        format: "jest" as const,
        summary: {
          totalTests: 10,
          passedTests: 8,
          failedTests: 2,
          skippedTests: 0,
        },
        failedTests: [
          {
            name: "src/__tests__/utils.test.ts",
            testMethod: "should parse config",
            message: "Cannot read property 'name' of undefined",
            stackTrace: "at parseConfig ...",
          },
        ],
        timestamp: "2026-04-18T18:40:08.403Z",
      };
      const parsed = TestParseResultSchema.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.failedTests).toHaveLength(1);
    });
  });

  // ── EnvRequirements & EnvCheckResult ──

  describe("EnvRequirementsSchema", () => {
    it("should accept env requirements with CI config path", () => {
      const req = {
        ciConfigPath: ".github/workflows/ci.yml",
      };
      const parsed = EnvRequirementsSchema.parse(req);
      expect(parsed.ciConfigPath).toBe(".github/workflows/ci.yml");
    });

    it("should accept explicit required vars and versions", () => {
      const req = {
        requiredVars: ["NODE_VERSION", "MAVEN_VERSION"],
        expectedVersions: {
          NODE_VERSION: "18.0.0",
          MAVEN_VERSION: "3.9.0",
        },
      };
      const parsed = EnvRequirementsSchema.parse(req);
      expect(parsed.requiredVars).toHaveLength(2);
      expect(parsed.expectedVersions?.NODE_VERSION).toBe("18.0.0");
    });
  });

  describe("EnvCheckResultSchema", () => {
    it("should accept successful env check result", () => {
      const result = {
        success: true,
        missingEnvVars: [],
        divergences: [],
        recommendations: [],
        timestamp: "2026-04-18T18:40:08.403Z",
        summary: {
          passed: true,
          issues: 0,
        },
      };
      const parsed = EnvCheckResultSchema.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.summary.passed).toBe(true);
    });

    it("should accept env check result with issues", () => {
      const result = {
        success: false,
        missingEnvVars: ["MAVEN_GPG_PASSPHRASE", "NPM_TOKEN"],
        divergences: [
          {
            variable: "NODE_VERSION",
            expectedVersion: "18.0.0",
            actualVersion: "16.14.0",
          },
        ],
        recommendations: [
          "export MAVEN_GPG_PASSPHRASE=<your-passphrase>",
          "nvm install 18.0.0",
        ],
        timestamp: "2026-04-18T18:40:08.403Z",
        summary: {
          passed: false,
          issues: 3,
        },
      };
      const parsed = EnvCheckResultSchema.parse(result);
      expect(parsed.missingEnvVars).toHaveLength(2);
      expect(parsed.summary.issues).toBe(3);
    });
  });

  // ── SandboxConfigValidation ──

  describe("SandboxConfigValidationSchema", () => {
    it("should accept config validation request", () => {
      const req = {
        config: {
          projectDir: "/home/user/project",
          stack: "maven" as const,
          isolation: "docker" as const,
        },
        validateStrictly: true,
      };
      const parsed = SandboxConfigValidationSchema.parse(req);
      expect(parsed.validateStrictly).toBe(true);
    });
  });

  describe("ValidationResultSchema", () => {
    it("should accept valid config result", () => {
      const result = {
        valid: true,
        issues: [],
        toolAvailability: {
          docker: true,
          podman: false,
          process: true,
        },
        recommendedIsolation: "docker" as const,
        timestamp: "2026-04-18T18:40:08.403Z",
      };
      const parsed = ValidationResultSchema.parse(result);
      expect(parsed.valid).toBe(true);
      expect(parsed.toolAvailability?.docker).toBe(true);
    });

    it("should accept invalid config result with issues", () => {
      const result = {
        valid: false,
        issues: [
          {
            level: "error" as const,
            field: "projectDir",
            message: "Directory not found: /invalid/path",
            suggestion: "Check path and permissions",
          },
          {
            level: "warning" as const,
            field: "image",
            message: "Image may not be available locally",
            suggestion: "Run 'docker pull maven:3.9.0'",
          },
        ],
        timestamp: "2026-04-18T18:40:08.403Z",
      };
      const parsed = ValidationResultSchema.parse(result);
      expect(parsed.valid).toBe(false);
      expect(parsed.issues).toHaveLength(2);
    });
  });

  // ── ReportIntegrationInput & Output ──

  describe("ReportIntegrationInputSchema", () => {
    it("should accept report input with file path and format", () => {
      const input = {
        testOutput: "/tmp/sandbox-xyz/target/surefire-reports/TEST-com.example.MyTest.xml",
        testFormat: "surefire" as const,
        nodeId: "node_abc123",
        updateGraph: true,
      };
      const parsed = ReportIntegrationInputSchema.parse(input);
      expect(parsed.nodeId).toBe("node_abc123");
      expect(parsed.updateGraph).toBe(true);
    });

    it("should accept report input with inline content", () => {
      const input = {
        testOutput: `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example" tests="10" failures="0" skipped="0">
</testsuite>`,
        testFormat: "auto" as const,
      };
      const parsed = ReportIntegrationInputSchema.parse(input);
      expect(parsed.testFormat).toBe("auto");
    });
  });

  describe("ReportIntegrationResultSchema", () => {
    it("should accept successful report integration", () => {
      const result = {
        success: true,
        parsedTests: {
          success: true,
          format: "surefire" as const,
          summary: {
            totalTests: 25,
            passedTests: 25,
            failedTests: 0,
            skippedTests: 0,
          },
          timestamp: "2026-04-18T18:40:08.403Z",
        },
        graphUpdateStatus: "updated" as const,
        nodeStatus: "done" as const,
        rationale: "All tests passed; task is complete",
        timestamp: "2026-04-18T18:40:08.403Z",
      };
      const parsed = ReportIntegrationResultSchema.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.nodeStatus).toBe("done");
    });

    it("should accept failed report integration with blocked node", () => {
      const result = {
        success: true,
        parsedTests: {
          success: false,
          format: "jest" as const,
          summary: {
            totalTests: 10,
            passedTests: 8,
            failedTests: 2,
            skippedTests: 0,
          },
          failedTests: [
            {
              name: "utils.test.ts",
              testMethod: "should parse",
              message: "Error: expected 10, got 5",
            },
          ],
          timestamp: "2026-04-18T18:40:08.403Z",
        },
        graphUpdateStatus: "updated" as const,
        nodeStatus: "blocked" as const,
        rationale: "2 test failures detected; task blocked",
        timestamp: "2026-04-18T18:40:08.403Z",
      };
      const parsed = ReportIntegrationResultSchema.parse(result);
      expect(parsed.nodeStatus).toBe("blocked");
    });
  });

  // ── Union Types ──

  describe("SandboxToolInputSchema (union)", () => {
    it("should accept build action input", () => {
      const input = {
        action: "build" as const,
        projectDir: "/home/user/project",
        stack: "maven" as const,
      };
      const parsed = SandboxToolInputSchema.parse(input);
      expect(parsed.action).toBe("build");
    });

    it("should accept report action input", () => {
      const input = {
        action: "report" as const,
        testOutput: "/tmp/results.xml",
        testFormat: "surefire" as const,
        nodeId: "node_123",
        updateGraph: true,
      };
      const parsed = SandboxToolInputSchema.parse(input);
      expect(parsed.action).toBe("report");
    });

    it("should accept check-env action input", () => {
      const input = {
        action: "check-env" as const,
        ciConfigPath: ".github/workflows/ci.yml",
      };
      const parsed = SandboxToolInputSchema.parse(input);
      expect(parsed.action).toBe("check-env");
    });

    it("should accept validate action input", () => {
      const input = {
        action: "validate" as const,
        config: {
          projectDir: "/home/user/project",
        },
        validateStrictly: true,
      };
      const parsed = SandboxToolInputSchema.parse(input);
      expect(parsed.action).toBe("validate");
    });

    it("should reject unknown action", () => {
      expect(() =>
        SandboxToolInputSchema.parse({
          action: "unknown",
          projectDir: "/path",
        }),
      ).toThrow();
    });
  });

  describe("SandboxToolOutputSchema (union)", () => {
    it("should accept BuildResult output", () => {
      const output = {
        success: true,
        status: "success" as const,
        executionMode: "docker" as const,
        profile: "ci-mirror" as const,
        command: "mvn test",
        stack: "maven" as const,
        durationMs: 45000,
        output: "BUILD SUCCESS",
        timestamp: "2026-04-18T18:40:08.403Z",
        isolatedDir: "/tmp/sandbox",
        cacheKey: "sha256:abc",
        cacheHit: false,
      };
      const parsed = SandboxToolOutputSchema.parse(output);
      expect(parsed.success).toBe(true);
    });

    it("should accept EnvCheckResult output", () => {
      const output = {
        success: true,
        missingEnvVars: [],
        divergences: [],
        recommendations: [],
        timestamp: "2026-04-18T18:40:08.403Z",
        summary: {
          passed: true,
          issues: 0,
        },
      };
      const parsed = SandboxToolOutputSchema.parse(output);
      expect(parsed.success).toBe(true);
    });

    it("should accept ValidationResult output", () => {
      const output = {
        valid: true,
        issues: [],
        timestamp: "2026-04-18T18:40:08.403Z",
      };
      const parsed = SandboxToolOutputSchema.parse(output);
      expect(parsed.valid).toBe(true);
    });

    it("should accept ReportIntegrationResult output", () => {
      const output = {
        success: true,
        parsedTests: {
          success: true,
          format: "surefire" as const,
          summary: {
            totalTests: 10,
            passedTests: 10,
            failedTests: 0,
            skippedTests: 0,
          },
          timestamp: "2026-04-18T18:40:08.403Z",
        },
        timestamp: "2026-04-18T18:40:08.403Z",
      };
      const parsed = SandboxToolOutputSchema.parse(output);
      expect(parsed.success).toBe(true);
    });
  });

  // ── Edge Cases ──

  describe("Edge cases and boundary conditions", () => {
    it("should handle empty credentials", () => {
      const input = {
        projectDir: "/path",
        credentials: {},
      };
      const parsed = SandboxBuildInputSchema.parse(input);
      expect(parsed.credentials).toEqual({});
    });

    it("should handle undefined credentials (optional)", () => {
      const input = {
        projectDir: "/path",
      };
      const parsed = SandboxBuildInputSchema.parse(input);
      expect(parsed.credentials).toBeUndefined();
    });

    it("should reject timeout > max allowed", () => {
      expect(() =>
        SandboxBuildInputSchema.parse({
          projectDir: "/path",
          timeout: 3600001, // > 1 hour
        }),
      ).toThrow();
    });

    it("should accept timeout == max allowed", () => {
      const input = {
        projectDir: "/path",
        timeout: 3600000, // 1 hour
      };
      const parsed = SandboxBuildInputSchema.parse(input);
      expect(parsed.timeout).toBe(3600000);
    });

    it("should handle very long test output", () => {
      const longOutput = "x".repeat(100000);
      const result = {
        success: true,
        status: "success" as const,
        executionMode: "docker" as const,
        profile: "ci-mirror" as const,
        command: "test",
        stack: "npm" as const,
        durationMs: 1000,
        output: longOutput,
        timestamp: "2026-04-18T18:40:08.403Z",
        isolatedDir: "/tmp",
        cacheKey: "sha256:abc",
        cacheHit: false,
      };
      const parsed = BuildResultSchema.parse(result);
      expect(parsed.output.length).toBe(100000);
    });
  });
});
