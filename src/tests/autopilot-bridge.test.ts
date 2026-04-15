import { describe, it, expect } from "vitest";
import {
  AutopilotBridge,
} from "../core/autonomy/autopilot-bridge.js";

describe("AutopilotBridge — set_phase integration", () => {
  it("should start autopilot session when enabled", () => {
    const bridge = new AutopilotBridge();

    const result = bridge.handlePhaseChange("IMPLEMENT", true, "sprint-1");

    expect(result.autopilotActive).toBe(true);
    expect(result.sessionId).toBeTruthy();
    expect(result.action).toBe("started");
  });

  it("should stop autopilot and return summary when disabled", () => {
    const bridge = new AutopilotBridge();
    bridge.handlePhaseChange("IMPLEMENT", true, "sprint-1");

    const result = bridge.handlePhaseChange("IMPLEMENT", false);

    expect(result.autopilotActive).toBe(false);
    expect(result.action).toBe("stopped");
    expect(result.summary).toBeDefined();
  });

  it("should return no-op when autopilot param not provided (backward compat)", () => {
    const bridge = new AutopilotBridge();

    const result = bridge.handlePhaseChange("IMPLEMENT", undefined);

    expect(result.autopilotActive).toBe(false);
    expect(result.action).toBe("unchanged");
  });

  it("should return no-op when already running and enabled again", () => {
    const bridge = new AutopilotBridge();
    bridge.handlePhaseChange("IMPLEMENT", true, "sprint-1");

    const result = bridge.handlePhaseChange("IMPLEMENT", true, "sprint-1");

    expect(result.autopilotActive).toBe(true);
    expect(result.action).toBe("already_running");
  });

  it("should expose controller for evaluateNext calls", () => {
    const bridge = new AutopilotBridge();
    bridge.handlePhaseChange("IMPLEMENT", true, "sprint-1");

    const controller = bridge.getController();
    expect(controller).not.toBeNull();
  });

  it("should return null controller when not active", () => {
    const bridge = new AutopilotBridge();
    expect(bridge.getController()).toBeNull();
  });
});
