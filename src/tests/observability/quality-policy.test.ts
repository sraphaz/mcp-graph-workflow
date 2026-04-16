import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  QualityPolicyStore,
  evaluatePolicy,
  type QualityPolicy,
  type QualityGate,
} from "../../core/observability/quality-policy.js";
import { runMigrations } from "../../core/store/migrations.js";

describe("QualityPolicy", () => {
  let db: Database.Database;
  let policyStore: QualityPolicyStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    policyStore = new QualityPolicyStore(db);
  });

  // ── Pure evaluation logic ────────────────────────────

  it("should pass when all metrics meet thresholds", () => {
    const policy: QualityPolicy = {
      id: "p1",
      name: "default",
      gates: [
        { metric: "harness_score", operator: ">=", threshold: 70, severity: "block" },
        { metric: "security_score", operator: ">=", threshold: 80, severity: "block" },
      ],
      active: true,
    };

    const result = evaluatePolicy(policy, { harness_score: 85, security_score: 95 });
    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("should block when any block-severity gate fails", () => {
    const policy: QualityPolicy = {
      id: "p1",
      name: "strict",
      gates: [
        { metric: "harness_score", operator: ">=", threshold: 70, severity: "block" },
        { metric: "security_score", operator: ">=", threshold: 80, severity: "block" },
      ],
      active: true,
    };

    const result = evaluatePolicy(policy, { harness_score: 60, security_score: 95 });
    expect(result.passed).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]!.metric).toBe("harness_score");
  });

  it("should warn (not block) when warn-severity gate fails", () => {
    const policy: QualityPolicy = {
      id: "p1",
      name: "lenient",
      gates: [
        { metric: "test_pass_rate", operator: ">=", threshold: 80, severity: "warn" },
      ],
      active: true,
    };

    const result = evaluatePolicy(policy, { test_pass_rate: 60 });
    expect(result.passed).toBe(true); // warn doesn't block
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.metric).toBe("test_pass_rate");
  });

  it("should support != operator for trend checks", () => {
    const policy: QualityPolicy = {
      id: "p1",
      name: "trend",
      gates: [
        { metric: "trend_direction", operator: "!=", threshold: -1, severity: "warn" },
      ],
      active: true,
    };

    // trend_direction == -1 means declining → should warn
    const result = evaluatePolicy(policy, { trend_direction: -1 });
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it("should support <= operator", () => {
    const policy: QualityPolicy = {
      id: "p1",
      name: "cost",
      gates: [
        { metric: "avg_cost", operator: "<=", threshold: 0.05, severity: "block" },
      ],
      active: true,
    };

    expect(evaluatePolicy(policy, { avg_cost: 0.03 }).passed).toBe(true);
    expect(evaluatePolicy(policy, { avg_cost: 0.10 }).passed).toBe(false);
  });

  // ── Store operations ─────────────────────────────────

  it("should create and retrieve policy", () => {
    const gates: QualityGate[] = [
      { metric: "harness_score", operator: ">=", threshold: 70, severity: "block" },
    ];

    const id = policyStore.createPolicy("my_policy", gates);
    const policy = policyStore.getPolicy(id);

    expect(policy).not.toBeNull();
    expect(policy!.name).toBe("my_policy");
    expect(policy!.gates).toHaveLength(1);
    expect(policy!.active).toBe(false);
  });

  it("should activate policy and deactivate others", () => {
    const id1 = policyStore.createPolicy("policy_a", []);
    const id2 = policyStore.createPolicy("policy_b", []);

    policyStore.activatePolicy(id1);
    expect(policyStore.getActivePolicy()?.id).toBe(id1);

    policyStore.activatePolicy(id2);
    expect(policyStore.getActivePolicy()?.id).toBe(id2);

    // Policy A should be deactivated
    expect(policyStore.getPolicy(id1)?.active).toBe(false);
  });

  it("should seed default policy on migration", () => {
    // Default policy should exist after migrations
    const active = policyStore.getActivePolicy();
    expect(active).not.toBeNull();
    expect(active!.name).toBe("default");
    expect(active!.gates.length).toBeGreaterThanOrEqual(2);
  });
});
