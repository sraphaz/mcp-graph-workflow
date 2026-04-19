import { describe, it, expect } from "vitest";
import {
  Wave12GoalsSchema,
  Wave12OutOfScopeSchema,
  Wave12GoalSchema,
} from "../schemas/wave-12-prd-schema.js";

describe("Wave-12 Goals Schema", () => {
  describe("Wave12GoalSchema (individual SMART goal)", () => {
    it("should validate a complete SMART goal with all required fields", () => {
      const validGoal = {
        id: "goal-isolation-quality",
        title: "Achieve 100% build validation isolation",
        description: "Ensure all builds execute in isolated environments",
        specific: "Process all Maven builds in isolated directory",
        measurable: "0 environment crosstalk incidents per sprint",
        achievable: "Implement process isolation layer in Resolver",
        relevant: "Reduces feedback loop time and CI failures",
        timebound: "Q2 2026",
        category: "isolation_quality",
        targetValue: "100%",
        unit: "builds",
        deadline: "2026-06-30T23:59:59Z",
      };

      const result = Wave12GoalSchema.safeParse(validGoal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("goal-isolation-quality");
        expect(result.data.title).toContain("isolation");
      }
    });

    it("should require at least the SMART dimensions", () => {
      const incompleteSmart = {
        id: "goal-incomplete",
        title: "Improve build",
        description: "Make builds faster",
        specific: "",
        measurable: "",
        achievable: "",
        relevant: "",
        timebound: "",
        category: "performance",
      };

      const result = Wave12GoalSchema.safeParse(incompleteSmart);
      expect(result.success).toBe(false);
    });

    it("should validate the category enum", () => {
      const goalWithValidCategory = {
        id: "goal-test-reliability",
        title: "Achieve 95% test reliability",
        description: "Improve test outcomes and reduce flakiness",
        specific: "Detect flaky tests in each build cycle",
        measurable: "90% pass rate consistency across three consecutive runs",
        achievable: "Implement flake detection and retry logic",
        relevant: "Reduces noise and feedback time for developers",
        timebound: "Q2 2026",
        category: "test_reliability",
        targetValue: "95",
        unit: "percent",
        deadline: "2026-06-30T23:59:59Z",
      };

      const result = Wave12GoalSchema.safeParse(goalWithValidCategory);
      expect(result.success).toBe(true);
    });

    it("should reject invalid deadline format", () => {
      const goalBadDate = {
        id: "goal-bad-date",
        title: "Some goal",
        description: "Description",
        specific: "Specific part",
        measurable: "Measurable part",
        achievable: "Achievable part",
        relevant: "Relevant part",
        timebound: "Q2 2026",
        category: "feedback_loop_speed",
        deadline: "not-a-valid-date",
      };

      const result = Wave12GoalSchema.safeParse(goalBadDate);
      expect(result.success).toBe(false);
    });
  });

  describe("Wave12GoalsSchema (collection of goals)", () => {
    it("should validate all 5 required goals for Wave-12", () => {
      const wave12Goals = {
        waveId: "wave-12",
        goals: [
          {
            id: "goal-isolation-quality",
            title: "Achieve 100% build validation isolation",
            description:
              "Ensure all builds execute in isolated environments with zero crosstalk",
            specific: "Process all Maven builds in isolated directory without env vars leaking",
            measurable: "0 environment crosstalk incidents per sprint",
            achievable: "Implement process/Docker isolation layer in Resolver",
            relevant: "Reduces feedback loop time and CI failures",
            timebound: "Q2 2026",
            category: "isolation_quality",
            targetValue: "100%",
            unit: "builds",
            deadline: "2026-06-30T23:59:59Z",
          },
          {
            id: "goal-feedback-speed",
            title: "Reduce local feedback loop to <2 minutes",
            description:
              "Enable developers to get test results locally faster than waiting for CI",
            specific: "Achieve average local test run time of <120 seconds for MVP",
            measurable: "Average feedback latency <= 120s from start_task to finish_task",
            achievable: "Implement cache layer and incremental builds",
            relevant: "Faster iteration = fewer push cycles = less CI load",
            timebound: "Q2 2026",
            category: "feedback_loop_speed",
            targetValue: "120",
            unit: "seconds",
            deadline: "2026-06-30T23:59:59Z",
          },
          {
            id: "goal-test-reliability",
            title: "Achieve 95% local-to-CI parity",
            description:
              "Ensure tests that pass locally have 95% chance of passing in CI",
            specific:
              "Build environment (Maven, Java version, deps) mirrors CI config",
            measurable: "Parity score = (pass_local AND pass_ci) / (all_test_runs) >= 95%",
            achievable: "Implement ci-mirror profile with Docker image from CI pipeline",
            relevant: "Reduces surprise CI failures and deployment risk",
            timebound: "Q2 2026",
            category: "test_reliability",
            targetValue: "95",
            unit: "percent",
            deadline: "2026-06-30T23:59:59Z",
          },
          {
            id: "goal-local-fidelity",
            title: "Mirror CI environment with 100% accuracy on core layer",
            description:
              "Local sandbox reproduces the exact CI build environment for critical tools",
            specific:
              "Maven version, Java version, and key deps match CI to patch level",
            measurable:
              "Version mismatch incidents for Maven/Java = 0 per sprint",
            achievable: "Parse CI YAML and enforce version parity via ci-mirror profile",
            relevant: "Eliminates environment-specific surprises",
            timebound: "Q2 2026",
            category: "local_fidelity",
            targetValue: "100",
            unit: "percent",
            deadline: "2026-06-30T23:59:59Z",
          },
          {
            id: "goal-cost-reduction",
            title: "Reduce CI resource utilization by 30%",
            description:
              "Catch preventable failures locally before they reach CI, reducing wasted compute",
            specific:
              "Failed builds that could have been caught locally drop from 20% to 10% of all CI runs",
            measurable:
              "Reduction in failed CI builds = 50% fewer failures after Onda 12 MVP",
            achievable:
              "Mandatory sandbox validation before push via finish_task gate",
            relevant: "Lower cost + faster feedback + happier team",
            timebound: "Q2 2026",
            category: "cost_reduction",
            targetValue: "30",
            unit: "percent",
            deadline: "2026-06-30T23:59:59Z",
          },
        ],
        description:
          "Five SMART goals for Wave-12 Sandbox Build covering isolation, speed, reliability, fidelity, and cost.",
        graphNodeId: "node_ec6945f114a8",
        metadata: {
          phase: "ANALYZE",
          tags: ["wave-12", "sandbox", "goals", "smart"],
          isConsolidated: true,
          sourceFile:
            "docs/prd/waves/wave-12-sandbox-build-local-ci-cd-isolation.md",
        },
        createdAt: new Date().toISOString(),
        createdBy: "agent-wave12-2",
      };

      const result = Wave12GoalsSchema.safeParse(wave12Goals);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.goals).toHaveLength(5);
        expect(result.data.goals[0].id).toBe("goal-isolation-quality");
        expect(result.data.goals[1].category).toBe("feedback_loop_speed");
      }
    });

    it("should require at least 4 goals", () => {
      const tooFewGoals = {
        waveId: "wave-12",
        goals: [
          {
            id: "goal-1",
            title: "Goal 1",
            description: "Description",
            specific: "Specific",
            measurable: "Measurable",
            achievable: "Achievable",
            relevant: "Relevant",
            timebound: "Q2 2026",
            category: "isolation_quality",
            deadline: "2026-06-30T23:59:59Z",
          },
          {
            id: "goal-2",
            title: "Goal 2",
            description: "Description",
            specific: "Specific",
            measurable: "Measurable",
            achievable: "Achievable",
            relevant: "Relevant",
            timebound: "Q2 2026",
            category: "feedback_loop_speed",
            deadline: "2026-06-30T23:59:59Z",
          },
          {
            id: "goal-3",
            title: "Goal 3",
            description: "Description",
            specific: "Specific",
            measurable: "Measurable",
            achievable: "Achievable",
            relevant: "Relevant",
            timebound: "Q2 2026",
            category: "test_reliability",
            deadline: "2026-06-30T23:59:59Z",
          },
        ],
        description: "Only 3 goals",
        createdAt: new Date().toISOString(),
        createdBy: "agent-wave12-2",
      };

      const result = Wave12GoalsSchema.safeParse(tooFewGoals);
      expect(result.success).toBe(false);
    });
  });
});

describe("Wave-12 Out of Scope Schema", () => {
  describe("Wave12OutOfScopeSchema", () => {
    it("should validate all out-of-scope items for Wave-12", () => {
      const outOfScope = {
        waveId: "wave-12",
        items: [
          {
            id: "oos-remote-ci",
            title: "Replace remote CI pipeline",
            description:
              "The sandbox is not intended to replace the existing remote CI infrastructure; it augments local validation only.",
            rationale:
              "CI pipeline serves purposes beyond build validation (artifact storage, deployment coordination, compliance gates)",
            affectedBy: [
              "task-finish-with-quality-gates",
              "task-integration-with-pipeline",
            ],
            type: "infrastructure_replacement",
          },
          {
            id: "oos-prod-deploy",
            title: "Execute production deployment from sandbox",
            description:
              "The sandbox will not support direct production deployment; deployment remains a CI/CD responsibility.",
            rationale:
              "Production deployment requires compliance, approval workflows, and artifact provenance that belong in CI",
            affectedBy: ["task-release-management"],
            type: "deployment_scope",
          },
          {
            id: "oos-multi-stack-mvp",
            title: "Cover all build stacks in MVP",
            description:
              "MVP focuses on Maven/Java; Gradle, npm, Go, Python support deferred to v1+.",
            rationale:
              "Each stack requires unique resolver/builder logic; scope must be limited for MVP delivery",
            affectedBy: ["task-stack-support"],
            type: "technology_scope",
          },
        ],
        description:
          "Three items explicitly out of scope for Wave-12 MVP to maintain focus and deliverability.",
        graphNodeId: "node_44c789736369",
        metadata: {
          phase: "ANALYZE",
          tags: ["wave-12", "sandbox", "out-of-scope"],
          isConsolidated: true,
          sourceFile:
            "docs/prd/waves/wave-12-sandbox-build-local-ci-cd-isolation.md",
        },
        createdAt: new Date().toISOString(),
        createdBy: "agent-wave12-2",
      };

      const result = Wave12OutOfScopeSchema.safeParse(outOfScope);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(3);
        expect(result.data.items[0].type).toBe("infrastructure_replacement");
        expect(result.data.items[2].title).toContain("stack");
      }
    });

    it("should require at least 3 out-of-scope items", () => {
      const tooFewItems = {
        waveId: "wave-12",
        items: [
          {
            id: "oos-1",
            title: "Item 1",
            description: "Description",
            rationale: "Rationale",
            type: "infrastructure_replacement",
          },
          {
            id: "oos-2",
            title: "Item 2",
            description: "Description",
            rationale: "Rationale",
            type: "deployment_scope",
          },
        ],
        description: "Only 2 items",
        createdAt: new Date().toISOString(),
        createdBy: "agent-wave12-2",
      };

      const result = Wave12OutOfScopeSchema.safeParse(tooFewItems);
      expect(result.success).toBe(false);
    });

    it("should validate the item type enum", () => {
      const validTypeItem = {
        waveId: "wave-12",
        items: [
          {
            id: "oos-cost",
            title: "Cost reduction of >50%",
            description: "We are not targeting extreme cost reduction",
            rationale: "Business model supports current cost",
            type: "business_constraint",
          },
          {
            id: "oos-perf",
            title: "Real-time feedback",
            description: "Not targeting sub-second feedback",
            rationale: "UI responsiveness is adequate at 120s",
            type: "performance_requirement",
          },
          {
            id: "oos-compliance",
            title: "HIPAA compliance on sandbox",
            description: "Sandbox is not HIPAA-certified",
            rationale: "Certification owned by CI infrastructure",
            type: "compliance_requirement",
          },
        ],
        description: "Valid types",
        createdAt: new Date().toISOString(),
        createdBy: "agent-wave12-2",
      };

      const result = Wave12OutOfScopeSchema.safeParse(validTypeItem);
      expect(result.success).toBe(true);
    });
  });
});
