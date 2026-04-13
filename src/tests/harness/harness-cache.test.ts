/**
 * TDD: harness scan cache with TTL 60s
 *
 * Tests for the cached harness scan that avoids re-scanning
 * on every MCP tool call.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runHarnessScanCached, resetHarnessCache } from "../../core/harness/harness-cache.js";

describe("runHarnessScanCached", () => {
  beforeEach(() => {
    resetHarnessCache();
    vi.restoreAllMocks();
  });

  it("returns a valid scan result on first call (cache miss)", () => {
    const result = runHarnessScanCached(process.cwd());
    expect(result).not.toBeNull();
    expect(typeof result!.score).toBe("number");
    expect(["A", "B", "C", "D"]).toContain(result!.grade);
  });

  it("returns cached result on second call within TTL", () => {
    const first = runHarnessScanCached(process.cwd());
    const second = runHarnessScanCached(process.cwd());
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    // Same timestamp = same cached result
    expect(first!.timestamp).toBe(second!.timestamp);
  });

  it("returns null gracefully when scan fails", () => {
    // Pass an invalid directory to force scan failure
    const result = runHarnessScanCached("/nonexistent/path/that/doesnt/exist");
    expect(result).toBeNull();
  });

  it("resetHarnessCache clears the cache", () => {
    const first = runHarnessScanCached(process.cwd());
    expect(first).not.toBeNull();

    resetHarnessCache();

    const second = runHarnessScanCached(process.cwd());
    expect(second).not.toBeNull();
    // Different timestamp after cache reset
    expect(first!.timestamp).not.toBe(second!.timestamp);
  });
});
