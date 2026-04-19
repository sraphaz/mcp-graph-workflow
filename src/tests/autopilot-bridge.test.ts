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
