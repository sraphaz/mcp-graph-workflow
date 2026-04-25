// Draft — copy to /Users/diegonogueira/mcp-graph-workflow/tools/cli/src/runtime/capability-gate.test.ts
//
// Test suite anchors AC of node_2471d7b4d664 (eva-agent graph) and ADR-0054 verification list.

import { describe, expect, it } from "vitest";
import { decideFeatureGate, getTier, isFeatureEnabled } from "./capability-gate";

describe("capability-gate / ADR-0054", () => {
  describe("T1 high reasoning — feature ON", () => {
    it.each([
      ["claude-opus-4-7"],
      ["claude-opus-4-6"],
      ["claude-sonnet-4-6"],
      ["gpt-5"],
      ["gpt-5-turbo"],
      ["deepseek-r1"],
      ["deepseek-r1-distill"],
      ["qwen3-235b-a22b-thinking"],
    ])("activates feature for %s", (modelId) => {
      const decision = decideFeatureGate(modelId, "assembleSiblingContext", {});
      expect(decision.tier).toBe("T1");
      expect(decision.enabled).toBe(true);
      expect(decision.warning).toBeUndefined();
    });
  });

  describe("T2 capable mid — feature ON pending telemetry", () => {
    it.each([
      ["claude-sonnet-4-5"],
      ["gpt-4o"],
      ["gpt-4-turbo"],
      ["mistral-large"],
      ["mistral-large-2"],
      ["llama-3.3-70b"],
    ])("activates feature for %s with telemetry note", (modelId) => {
      const decision = decideFeatureGate(modelId, "assembleSiblingContext", {});
      expect(decision.tier).toBe("T2");
      expect(decision.enabled).toBe(true);
      expect(decision.reason).toContain("tier_T2");
    });
  });

  describe("T3 small/quantized — feature ON with advisory warning (post-H12 default)", () => {
    it.each([
      ["claude-haiku-4-5"],
      ["claude-haiku-3-5"],
      ["gpt-4o-mini"],
      ["gpt-3.5-turbo"],
      ["mistral-7b"],
      ["llama-3-8b"],
    ])("activates feature for %s with advisory warning", (modelId) => {
      const decision = decideFeatureGate(modelId, "assembleSiblingContext", {});
      expect(decision.tier).toBe("T3");
      expect(decision.enabled).toBe(true);
      expect(decision.warning).toMatch(/BENCHMARK-v11/);
      expect(decision.warning).toMatch(/H12/);
      expect(decision.reason).toContain("advisory_default");
    });
  });

  describe("T3 strict mode — feature OFF when MCP_GRAPH_GATE_STRICT=1", () => {
    it.each([
      ["claude-haiku-4-5"],
      ["mistral-7b"],
    ])("blocks feature for %s under strict mode", (modelId) => {
      const decision = decideFeatureGate(
        modelId,
        "assembleSiblingContext",
        { MCP_GRAPH_GATE_STRICT: "1" },
      );
      expect(decision.tier).toBe("T3");
      expect(decision.enabled).toBe(false);
      expect(decision.reason).toContain("strict_block");
    });
  });

  describe("T4 unknown — capability_lookup_miss", () => {
    it.each([
      ["bogus-model"],
      ["my-custom-model-v1"],
      ["claude-haiku-2"],
      ["random-string"],
    ])("disables feature for %s and emits lookup-miss log", (modelId) => {
      const decision = decideFeatureGate(modelId, "assembleSiblingContext", {});
      expect(decision.tier).toBe("T4");
      expect(decision.enabled).toBe(false);
      expect(decision.reason).toContain("capability_lookup_miss");
      expect(decision.warning).toContain("capability_lookup_miss");
      expect(decision.warning).toContain(modelId);
    });
  });

  describe("override via MCP_GRAPH_FORCE_FEATURE", () => {
    it("forces enable on T3 model when env=1", () => {
      const decision = decideFeatureGate(
        "claude-haiku-4-5",
        "assembleSiblingContext",
        { MCP_GRAPH_FORCE_FEATURE: "1" },
      );
      expect(decision.enabled).toBe(true);
      expect(decision.reason).toBe("forced_by_env");
      expect(decision.warning).toMatch(/ADR-0054/);
      expect(decision.warning).toMatch(/BENCHMARK-v11/);
    });

    it("does not force on env=0; T3 advisory default still ON", () => {
      const decision = decideFeatureGate(
        "claude-haiku-4-5",
        "assembleSiblingContext",
        { MCP_GRAPH_FORCE_FEATURE: "0" },
      );
      expect(decision.enabled).toBe(true);
      expect(decision.reason).toContain("advisory_default");
    });

    it("FORCE wins over STRICT (force takes precedence)", () => {
      const decision = decideFeatureGate(
        "claude-haiku-4-5",
        "assembleSiblingContext",
        { MCP_GRAPH_FORCE_FEATURE: "1", MCP_GRAPH_GATE_STRICT: "1" },
      );
      expect(decision.enabled).toBe(true);
      expect(decision.reason).toBe("forced_by_env");
    });

    it("preserves T4 unknown classification under override", () => {
      const decision = decideFeatureGate(
        "bogus-model",
        "assembleSiblingContext",
        { MCP_GRAPH_FORCE_FEATURE: "1" },
      );
      expect(decision.tier).toBe("T4");
      expect(decision.enabled).toBe(true);
    });
  });

  describe("unknown features", () => {
    it("returns disabled with unknown_feature reason for any tier", () => {
      const decision = decideFeatureGate(
        "claude-sonnet-4-6",
        "futureFeature" as never,
        {},
      );
      expect(decision.enabled).toBe(false);
      expect(decision.reason).toBe("unknown_feature");
    });
  });

  describe("convenience helpers", () => {
    it("isFeatureEnabled mirrors decideFeatureGate.enabled", () => {
      expect(isFeatureEnabled("claude-sonnet-4-6", "assembleSiblingContext")).toBe(true);
      expect(isFeatureEnabled("claude-haiku-4-5", "assembleSiblingContext")).toBe(false);
    });

    it("getTier reflects classification", () => {
      expect(getTier("claude-opus-4-7")).toBe("T1");
      expect(getTier("claude-sonnet-4-5")).toBe("T2");
      expect(getTier("claude-haiku-4-5")).toBe("T3");
      expect(getTier("nonexistent-model")).toBe("T4");
    });
  });

  describe("regression guards (anchors AC of eva-agent node_2471d7b4d664, post-H12 v2)", () => {
    it("haiku-4-5 default → ON + advisory warning (was OFF in v1)", () => {
      const d = decideFeatureGate("claude-haiku-4-5", "assembleSiblingContext", {});
      expect(d.enabled).toBe(true);
      expect(d.warning).toBeDefined();
      expect(d.warning).toMatch(/H12/);
    });

    it("haiku-4-5 strict → OFF + warning", () => {
      const d = decideFeatureGate(
        "claude-haiku-4-5",
        "assembleSiblingContext",
        { MCP_GRAPH_GATE_STRICT: "1" },
      );
      expect(d.enabled).toBe(false);
      expect(d.warning).toBeDefined();
    });

    it("sonnet-4-6 → ON, no warning", () => {
      const d = decideFeatureGate("claude-sonnet-4-6", "assembleSiblingContext", {});
      expect(d.enabled).toBe(true);
      expect(d.warning).toBeUndefined();
    });

    it("unknown-model → OFF + capability_lookup_miss", () => {
      const d = decideFeatureGate("unknown-model", "assembleSiblingContext", {});
      expect(d.enabled).toBe(false);
      expect(d.reason).toContain("capability_lookup_miss");
    });
  });
});
