/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 2.1: classify FailureSignal → 5 new pattern classes.
 */

import { describe, it, expect } from "vitest";
import { classifySignals } from "../core/harness/issue-pattern-tracker.js";
import type { ClassifierSignal, ClassifierConfig } from "../core/harness/issue-pattern-tracker.js";

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;

function ts(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

function gateBlocked(toolName: string, offsetMs = 0): ClassifierSignal {
  return { source: "lifecycle_gate", signalKind: "gate_blocked", context: { toolName }, timestamp: ts(offsetMs) };
}

function toolIsError(toolName: string, offsetMs = 0): ClassifierSignal {
  return { source: "tool_invocation", signalKind: "tool_isError", context: { toolName }, timestamp: ts(offsetMs) };
}

function sqliteLock(kind: "SQLITE_BUSY" | "SQLITE_LOCKED", offsetMs = 0): ClassifierSignal {
  return { source: "sqlite", signalKind: kind, context: {}, timestamp: ts(offsetMs) };
}

function mcpException(adapterName: string, offsetMs = 0): ClassifierSignal {
  return { source: "mcp_server", signalKind: "uncaught_exception", context: { adapterName }, timestamp: ts(offsetMs) };
}

function dodFail(nodeId: string, checks: string[], offsetMs = 0): ClassifierSignal {
  return {
    source: "dod_check",
    signalKind: "dod_fail",
    context: { nodeId },
    rawError: checks.join(", "),
    timestamp: ts(offsetMs),
  };
}

describe("classifySignals — new pattern classes", () => {
  // ── AC1: gate_blocking_too_often ──────────────────────────
  describe("gate_blocking_too_often", () => {
    it("detects when same tool blocked ≥5 times in 1h", () => {
      const sigs = Array.from({ length: 5 }, (_, i) => gateBlocked("finish_task", i * MIN_MS));
      const patterns = classifySignals(sigs);
      expect(patterns.map((p) => p.patternType)).toContain("gate_blocking_too_often");
    });

    it("does NOT detect when blocked <5 times", () => {
      const sigs = Array.from({ length: 4 }, (_, i) => gateBlocked("finish_task", i * MIN_MS));
      expect(classifySignals(sigs).map((p) => p.patternType)).not.toContain("gate_blocking_too_often");
    });

    it("does NOT detect when 5 blocks are spread across different tools", () => {
      const sigs = [
        gateBlocked("tool_a", 0),
        gateBlocked("tool_b", MIN_MS),
        gateBlocked("tool_a", 2 * MIN_MS),
        gateBlocked("tool_c", 3 * MIN_MS),
        gateBlocked("tool_d", 4 * MIN_MS),
      ];
      expect(classifySignals(sigs).map((p) => p.patternType)).not.toContain("gate_blocking_too_often");
    });

    it("does NOT detect when all 5 events are outside the 1h window", () => {
      const sigs = Array.from({ length: 5 }, (_, i) => gateBlocked("finish_task", HOUR_MS + i * MIN_MS));
      expect(classifySignals(sigs).map((p) => p.patternType)).not.toContain("gate_blocking_too_often");
    });

    it("includes toolName in context when detected", () => {
      const sigs = Array.from({ length: 5 }, (_, i) => gateBlocked("finish_task", i * MIN_MS));
      const pattern = classifySignals(sigs).find((p) => p.patternType === "gate_blocking_too_often");
      expect(pattern?.context.toolName).toBe("finish_task");
    });
  });

  // ── AC2: tool_failing_for_input_kind ─────────────────────
  describe("tool_failing_for_input_kind", () => {
    it("detects when same tool fails ≥3 times", () => {
      const sigs = Array.from({ length: 3 }, (_, i) => toolIsError("start_task", i * MIN_MS));
      expect(classifySignals(sigs).map((p) => p.patternType)).toContain("tool_failing_for_input_kind");
    });

    it("does NOT detect when same tool fails <3 times", () => {
      const sigs = [toolIsError("start_task", 0), toolIsError("start_task", MIN_MS)];
      expect(classifySignals(sigs).map((p) => p.patternType)).not.toContain("tool_failing_for_input_kind");
    });

    it("includes toolName in context when detected", () => {
      const sigs = Array.from({ length: 3 }, (_, i) => toolIsError("start_task", i * MIN_MS));
      const pattern = classifySignals(sigs).find((p) => p.patternType === "tool_failing_for_input_kind");
      expect(pattern?.context.toolName).toBe("start_task");
    });
  });

  // ── AC3: sqlite_lock_storm ────────────────────────────────
  describe("sqlite_lock_storm", () => {
    it("detects when ≥3 SQLITE_BUSY occur within 5 min", () => {
      const sigs = Array.from({ length: 3 }, (_, i) => sqliteLock("SQLITE_BUSY", i * 30_000));
      expect(classifySignals(sigs).map((p) => p.patternType)).toContain("sqlite_lock_storm");
    });

    it("detects with SQLITE_LOCKED as well", () => {
      const sigs = Array.from({ length: 3 }, (_, i) => sqliteLock("SQLITE_LOCKED", i * 30_000));
      expect(classifySignals(sigs).map((p) => p.patternType)).toContain("sqlite_lock_storm");
    });

    it("does NOT detect when events are >5 min apart", () => {
      const sigs = Array.from({ length: 3 }, (_, i) => sqliteLock("SQLITE_BUSY", i * 10 * MIN_MS));
      expect(classifySignals(sigs).map((p) => p.patternType)).not.toContain("sqlite_lock_storm");
    });
  });

  // ── AC4: mcp_adapter_flaky ────────────────────────────────
  describe("mcp_adapter_flaky", () => {
    it("detects when same adapter has ≥3 uncaught exceptions", () => {
      const sigs = Array.from({ length: 3 }, (_, i) => mcpException("playwright-mcp", i * MIN_MS));
      expect(classifySignals(sigs).map((p) => p.patternType)).toContain("mcp_adapter_flaky");
    });

    it("does NOT detect when 3 exceptions come from different adapters", () => {
      const sigs = [mcpException("playwright-mcp", 0), mcpException("context7-mcp", MIN_MS), mcpException("other-mcp", 2 * MIN_MS)];
      expect(classifySignals(sigs).map((p) => p.patternType)).not.toContain("mcp_adapter_flaky");
    });

    it("includes adapterName in context when detected", () => {
      const sigs = Array.from({ length: 3 }, (_, i) => mcpException("playwright-mcp", i * MIN_MS));
      const pattern = classifySignals(sigs).find((p) => p.patternType === "mcp_adapter_flaky");
      expect(pattern?.context.adapterName).toBe("playwright-mcp");
    });
  });

  // ── AC5: dod_check_X_chronic ──────────────────────────────
  describe("dod_check_X_chronic", () => {
    it("detects when same check fails ≥3 times across different nodeIds", () => {
      const sigs = [
        dodFail("node_a", ["has_acceptance_criteria", "has_testable_ac"], 0),
        dodFail("node_b", ["has_acceptance_criteria"], MIN_MS),
        dodFail("node_c", ["has_acceptance_criteria", "has_estimate"], 2 * MIN_MS),
      ];
      const types = classifySignals(sigs).map((p) => p.patternType);
      expect(types).toContain("dod_check_has_acceptance_criteria_chronic");
    });

    it("includes checkName in context when detected", () => {
      const sigs = [
        dodFail("node_a", ["has_estimate"], 0),
        dodFail("node_b", ["has_estimate"], MIN_MS),
        dodFail("node_c", ["has_estimate"], 2 * MIN_MS),
      ];
      const pattern = classifySignals(sigs).find((p) => p.patternType === "dod_check_has_estimate_chronic");
      expect(pattern?.context.checkName).toBe("has_estimate");
    });

    it("does NOT detect when the same nodeId repeats (same feature, not different features)", () => {
      const sigs = [
        dodFail("node_a", ["has_estimate"], 0),
        dodFail("node_a", ["has_estimate"], MIN_MS),
        dodFail("node_a", ["has_estimate"], 2 * MIN_MS),
      ];
      expect(classifySignals(sigs).map((p) => p.patternType)).not.toContain("dod_check_has_estimate_chronic");
    });
  });

  // ── AC6: unknown fallback ─────────────────────────────────
  describe("unknown fallback (never guess)", () => {
    it("returns empty array when no signals provided", () => {
      expect(classifySignals([])).toHaveLength(0);
    });

    it("returns empty array for signals that match no pattern", () => {
      const sigs: ClassifierSignal[] = [
        { source: "sqlite", signalKind: "SQLITE_ERROR", context: {}, timestamp: ts(0) },
      ];
      expect(classifySignals(sigs)).toHaveLength(0);
    });

    it("does NOT include 'unknown' in results when patterns ARE detected", () => {
      const sigs = Array.from({ length: 5 }, (_, i) => gateBlocked("finish_task", i * MIN_MS));
      expect(classifySignals(sigs).map((p) => p.patternType)).not.toContain("unknown");
    });
  });

  // ── AC7: configurable thresholds ─────────────────────────
  describe("configurable thresholds", () => {
    it("respects a lower gateBlockingThreshold", () => {
      const config: ClassifierConfig = { gateBlockingThreshold: 3 };
      const sigs = Array.from({ length: 3 }, (_, i) => gateBlocked("finish_task", i * MIN_MS));
      expect(classifySignals(sigs, config).map((p) => p.patternType)).toContain("gate_blocking_too_often");
    });

    it("does NOT detect when count is below a raised gateBlockingThreshold", () => {
      const config: ClassifierConfig = { gateBlockingThreshold: 10 };
      const sigs = Array.from({ length: 5 }, (_, i) => gateBlocked("finish_task", i * MIN_MS));
      expect(classifySignals(sigs, config).map((p) => p.patternType)).not.toContain("gate_blocking_too_often");
    });

    it("respects a narrower sqliteLockStormWindowMs", () => {
      // 3 events 2 min apart — default 5 min window catches them; 1 min window does not
      const config: ClassifierConfig = { sqliteLockStormWindowMs: MIN_MS };
      const sigs = Array.from({ length: 3 }, (_, i) => sqliteLock("SQLITE_BUSY", i * 2 * MIN_MS));
      expect(classifySignals(sigs, config).map((p) => p.patternType)).not.toContain("sqlite_lock_storm");
    });

    it("respects a lower dodCheckChronicThreshold", () => {
      const config: ClassifierConfig = { dodCheckChronicThreshold: 2 };
      const sigs = [
        dodFail("node_a", ["has_estimate"], 0),
        dodFail("node_b", ["has_estimate"], MIN_MS),
      ];
      expect(classifySignals(sigs, config).map((p) => p.patternType)).toContain("dod_check_has_estimate_chronic");
    });
  });
});
