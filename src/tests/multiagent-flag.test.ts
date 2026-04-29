/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies (E19.T05).
 * Tests for MCP_GRAPH_MULTIAGENT feature flag + single-agent fallback.
 */

import { describe, it, expect } from "vitest";
import {
  isMultiAgentEnabled,
  selectExecutionMode,
  MULTIAGENT_ENV_VAR,
} from "../core/swarm/multiagent-flag.js";

describe("MCP_GRAPH_MULTIAGENT feature flag (E19.T05)", () => {
  it("MULTIAGENT_ENV_VAR is the documented name", () => {
    expect(MULTIAGENT_ENV_VAR).toBe("MCP_GRAPH_MULTIAGENT");
  });

  it("isMultiAgentEnabled defaults to false (multi-agent off by default)", () => {
    expect(isMultiAgentEnabled({})).toBe(false);
  });

  it("isMultiAgentEnabled returns true for accepted truthy values", () => {
    for (const v of ["on", "ON", "true", "TRUE", "1", "yes"]) {
      expect(isMultiAgentEnabled({ MCP_GRAPH_MULTIAGENT: v })).toBe(true);
    }
  });

  it("isMultiAgentEnabled returns false for explicit off / unknown values", () => {
    for (const v of ["off", "false", "0", "no", "", "maybe"]) {
      expect(isMultiAgentEnabled({ MCP_GRAPH_MULTIAGENT: v })).toBe(false);
    }
  });

  it("selectExecutionMode returns 'single' when flag off", () => {
    expect(selectExecutionMode({}).mode).toBe("single");
  });

  it("selectExecutionMode returns 'multi' when flag on", () => {
    expect(selectExecutionMode({ MCP_GRAPH_MULTIAGENT: "on" }).mode).toBe("multi");
  });

  it("selectExecutionMode override='single' forces single even when env on", () => {
    const result = selectExecutionMode({ MCP_GRAPH_MULTIAGENT: "on" }, { override: "single" });
    expect(result.mode).toBe("single");
    expect(result.reason).toBe("override");
  });

  it("selectExecutionMode override='multi' forces multi even when env off", () => {
    const result = selectExecutionMode({}, { override: "multi" });
    expect(result.mode).toBe("multi");
    expect(result.reason).toBe("override");
  });

  it("selectExecutionMode reason is 'env' when flag drives the decision", () => {
    expect(selectExecutionMode({ MCP_GRAPH_MULTIAGENT: "on" }).reason).toBe("env");
    expect(selectExecutionMode({}).reason).toBe("default");
  });
});
