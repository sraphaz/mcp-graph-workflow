/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { setPhaseCore } from "../core/planner/set-phase-core.js";
import { makeNode } from "./helpers/factories.js";

describe("setPhaseCore — pure-function extraction (A1)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  describe("strictness mode persistence", () => {
    it("writes lifecycle_strictness_mode when mode provided", () => {
      const result = setPhaseCore(store, { phase: "auto", mode: "advisory" });
      expect(result.ok).toBe(true);
      expect(store.getProjectSetting("lifecycle_strictness_mode")).toBe("advisory");
    });

    it("writes code_intelligence_mode when codeIntelligence provided", () => {
      setPhaseCore(store, { phase: "auto", codeIntelligence: "strict" });
      expect(store.getProjectSetting("code_intelligence_mode")).toBe("strict");
    });

    it("writes tool_prerequisites_mode when prerequisites provided", () => {
      setPhaseCore(store, { phase: "auto", prerequisites: "off" });
      expect(store.getProjectSetting("tool_prerequisites_mode")).toBe("off");
    });

    it("writes team_task_mode when teamTask provided", () => {
      setPhaseCore(store, { phase: "auto", teamTask: true });
      expect(store.getProjectSetting("team_task_mode")).toBe("on");
    });

    it("writes wip_strict_mode when wipStrict provided explicitly", () => {
      setPhaseCore(store, { phase: "auto", wipStrict: false });
      expect(store.getProjectSetting("wip_strict_mode")).toBe("false");
    });

    it("auto-defaults wip_strict_mode=true when teamTask=true and wipStrict not provided", () => {
      setPhaseCore(store, { phase: "auto", teamTask: true });
      expect(store.getProjectSetting("wip_strict_mode")).toBe("true");
    });

    it("writes wip_max_in_flight when maxInFlight provided", () => {
      setPhaseCore(store, { phase: "auto", maxInFlight: 5 });
      expect(store.getProjectSetting("wip_max_in_flight")).toBe("5");
    });

    it("writes all 7 settings together when full opts provided", () => {
      setPhaseCore(store, {
        phase: "auto",
        mode: "strict",
        codeIntelligence: "advisory",
        prerequisites: "advisory",
        teamTask: false,
        wipStrict: true,
        maxInFlight: 4,
      });

      expect(store.getProjectSetting("lifecycle_strictness_mode")).toBe("strict");
      expect(store.getProjectSetting("code_intelligence_mode")).toBe("advisory");
      expect(store.getProjectSetting("tool_prerequisites_mode")).toBe("advisory");
      expect(store.getProjectSetting("team_task_mode")).toBe("off");
      expect(store.getProjectSetting("wip_strict_mode")).toBe("true");
      expect(store.getProjectSetting("wip_max_in_flight")).toBe("4");
    });
  });

  describe("phase=auto path", () => {
    it("clears lifecycle_phase_override and returns reset_to_auto action", () => {
      store.setProjectSetting("lifecycle_phase_override", "HANDOFF");
      const result = setPhaseCore(store, { phase: "auto" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.action).toBe("reset_to_auto");
        expect(result.detectedPhase).toBeDefined();
      }
      expect(store.getProjectSetting("lifecycle_phase_override")).toBe("");
    });

    it("returns mode/codeIntelligence/prerequisites in result", () => {
      store.setProjectSetting("lifecycle_strictness_mode", "advisory");
      const result = setPhaseCore(store, { phase: "auto" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mode).toBe("advisory");
      }
    });
  });

  describe("phase override path", () => {
    it("writes lifecycle_phase_override and returns override action", () => {
      const node = makeNode({ status: "in_progress" });
      store.insertNode(node);

      const result = setPhaseCore(store, { phase: "IMPLEMENT", force: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.action).toBe("override");
        expect(result.phase).toBe("IMPLEMENT");
      }
      expect(store.getProjectSetting("lifecycle_phase_override")).toBe("IMPLEMENT");
    });

    it("blocks transition with phase_gate when strict mode and gate fails", () => {
      // ANALYZE→DESIGN requires an epic/requirement; empty store fails the gate
      const result = setPhaseCore(store, { phase: "DESIGN", mode: "strict" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("phase_gate_blocked");
        expect(result.error).toContain("phase_gate_blocked");
      }
    });

    it("allows blocked transition when force=true", () => {
      const result = setPhaseCore(store, { phase: "DESIGN", mode: "strict", force: true });
      expect(result.ok).toBe(true);
    });

    it("returns phaseSummaryIndexed flag when transitioning between different phases", () => {
      const node = makeNode({ status: "in_progress" });
      store.insertNode(node);

      const result = setPhaseCore(store, { phase: "VALIDATE", force: true });
      expect(result.ok).toBe(true);
      if (result.ok && result.action === "override") {
        expect(typeof result.phaseSummaryIndexed).toBe("boolean");
      }
    });

    it("returns cacheInvalidated=true when phase changes", () => {
      const node = makeNode({ status: "in_progress" });
      store.insertNode(node);

      const result = setPhaseCore(store, { phase: "VALIDATE", force: true });
      if (result.ok && result.action === "override") {
        expect(result.cacheInvalidated).toBe(true);
      }
    });

    it("does not include cacheInvalidated when phase is unchanged", () => {
      const node = makeNode({ status: "in_progress" });
      store.insertNode(node);
      // Two consecutive calls to same phase
      setPhaseCore(store, { phase: "IMPLEMENT", force: true });
      const result = setPhaseCore(store, { phase: "IMPLEMENT", force: true });

      if (result.ok && result.action === "override") {
        expect(result.cacheInvalidated).toBeUndefined();
      }
    });
  });

  describe("autopilot bridge", () => {
    it("returns autopilot result block when autopilot=true provided", () => {
      const result = setPhaseCore(store, {
        phase: "IMPLEMENT",
        force: true,
        autopilot: true,
        sprintId: "sprint-1",
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.action === "override") {
        expect(result.autopilot).toBeDefined();
        expect(result.autopilot).toHaveProperty("autopilotActive");
        expect(result.autopilot).toHaveProperty("action");
      }
    });

    it("omits autopilot field when autopilot not provided", () => {
      const result = setPhaseCore(store, { phase: "IMPLEMENT", force: true });
      if (result.ok && result.action === "override") {
        expect(result.autopilot).toBeUndefined();
      }
    });
  });
});
