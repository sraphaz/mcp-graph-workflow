/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Opt-out for the npm-registry update check (ADR-0057).
 *
 * `update-notifier` is the only network call mcp-graph makes by default
 * — it pings the npm registry once a day and surfaces a non-blocking
 * banner if a newer version exists. It is already skipped in MCP stdio
 * mode. This test covers the explicit user opt-out: setting
 * `MCP_GRAPH_NO_UPDATE_CHECK=1` must short-circuit the check entirely.
 */

import { describe, expect, it } from "vitest";
import { shouldCheckForUpdates } from "../core/utils/update-check.js";

describe("shouldCheckForUpdates", () => {
  it("returns true with an empty env (default behavior)", () => {
    expect(shouldCheckForUpdates({})).toBe(true);
  });

  it("returns true when MCP_GRAPH_NO_UPDATE_CHECK is unset", () => {
    expect(shouldCheckForUpdates({ HOME: "/Users/me" })).toBe(true);
  });

  it("returns true when MCP_GRAPH_NO_UPDATE_CHECK is '0'", () => {
    expect(shouldCheckForUpdates({ MCP_GRAPH_NO_UPDATE_CHECK: "0" })).toBe(true);
  });

  it("returns true when MCP_GRAPH_NO_UPDATE_CHECK is empty string", () => {
    expect(shouldCheckForUpdates({ MCP_GRAPH_NO_UPDATE_CHECK: "" })).toBe(true);
  });

  it("returns false when MCP_GRAPH_NO_UPDATE_CHECK is '1'", () => {
    expect(shouldCheckForUpdates({ MCP_GRAPH_NO_UPDATE_CHECK: "1" })).toBe(false);
  });

  it("returns false when MCP_GRAPH_NO_UPDATE_CHECK is 'true' (case-insensitive)", () => {
    expect(shouldCheckForUpdates({ MCP_GRAPH_NO_UPDATE_CHECK: "true" })).toBe(false);
    expect(shouldCheckForUpdates({ MCP_GRAPH_NO_UPDATE_CHECK: "TRUE" })).toBe(false);
  });

  it("returns false when CI=true (CI runs are non-interactive — no point notifying)", () => {
    expect(shouldCheckForUpdates({ CI: "true" })).toBe(false);
  });

  it("MCP_GRAPH_NO_UPDATE_CHECK takes precedence over absent CI", () => {
    expect(shouldCheckForUpdates({ MCP_GRAPH_NO_UPDATE_CHECK: "1" })).toBe(false);
  });
});
