import { describe, it, expect } from "vitest";
import { shouldSkipDashboard } from "../mcp/stdio-mode.js";

describe("shouldSkipDashboard", () => {
  it("returns true when MCP_STDIO_ONLY=1", () => {
    expect(shouldSkipDashboard({ MCP_STDIO_ONLY: "1" }, true)).toBe(true);
  });

  it("returns true when MCP_STDIO_ONLY=true", () => {
    expect(shouldSkipDashboard({ MCP_STDIO_ONLY: "true" }, true)).toBe(true);
  });

  it("returns false when MCP_FORCE_DASHBOARD=1 even if stdin is piped", () => {
    expect(shouldSkipDashboard({ MCP_FORCE_DASHBOARD: "1" }, false)).toBe(false);
  });

  it("returns true when stdin is not a TTY (piped — agent host)", () => {
    expect(shouldSkipDashboard({}, false)).toBe(true);
  });

  it("returns false when stdin is a TTY (interactive dev)", () => {
    expect(shouldSkipDashboard({}, true)).toBe(false);
  });

  it("MCP_STDIO_ONLY wins over MCP_FORCE_DASHBOARD", () => {
    expect(
      shouldSkipDashboard({ MCP_STDIO_ONLY: "1", MCP_FORCE_DASHBOARD: "1" }, true),
    ).toBe(true);
  });
});
