/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Characterization tests for FallbackResolver — the docker → podman → process
 * cascade contract that downstream sandbox callers depend on.
 */

import { describe, it, expect } from "vitest";
import {
  FallbackResolver,
  FallbackResultSchema,
  ToolAvailabilitySchema,
} from "../core/sandbox/fallback-resolver.js";

const resolver = new FallbackResolver();

describe("FallbackResolver.resolveExecutionMode", () => {
  it("Docker available → executionMode='docker', chain=['docker']", () => {
    const result = resolver.resolveExecutionMode({ docker: true, podman: true, process: true });
    expect(result.executionMode).toBe("docker");
    expect(result.fallbackChain).toEqual(["docker"]);
    expect(result.reason).toMatch(/Docker is available/);
  });

  it("Docker missing, Podman present → executionMode='podman', chain=['docker','podman']", () => {
    const result = resolver.resolveExecutionMode({ docker: false, podman: true, process: true });
    expect(result.executionMode).toBe("podman");
    expect(result.fallbackChain).toEqual(["docker", "podman"]);
    expect(result.reason).toMatch(/Podman as fallback/);
  });

  it("Docker + Podman missing → executionMode='process', chain=full", () => {
    const result = resolver.resolveExecutionMode({ docker: false, podman: false, process: true });
    expect(result.executionMode).toBe("process");
    expect(result.fallbackChain).toEqual(["docker", "podman", "process"]);
    expect(result.reason).toMatch(/process isolation as fallback/);
  });

  it("All unavailable → executionMode='error', chain=full, reason mentions all three", () => {
    const result = resolver.resolveExecutionMode({ docker: false, podman: false, process: false });
    expect(result.executionMode).toBe("error");
    expect(result.fallbackChain).toEqual(["docker", "podman", "process"]);
    expect(result.reason).toMatch(/No isolation method available/);
  });

  it("timestamp is ISO-8601", () => {
    const result = resolver.resolveExecutionMode({ docker: true, podman: false, process: true });
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });

  it("result conforms to FallbackResultSchema (Zod)", () => {
    const result = resolver.resolveExecutionMode({ docker: false, podman: true, process: true });
    expect(() => FallbackResultSchema.parse(result)).not.toThrow();
  });

  it("fallbackChain never duplicates entries", () => {
    for (const tools of [
      { docker: true, podman: true, process: true },
      { docker: false, podman: true, process: true },
      { docker: false, podman: false, process: true },
      { docker: false, podman: false, process: false },
    ]) {
      const result = resolver.resolveExecutionMode(tools);
      const unique = new Set(result.fallbackChain);
      expect(unique.size).toBe(result.fallbackChain.length);
    }
  });

  it("Docker preferred even when Podman is also available", () => {
    const result = resolver.resolveExecutionMode({ docker: true, podman: true, process: true });
    expect(result.executionMode).toBe("docker");
    expect(result.fallbackChain).not.toContain("podman");
  });
});

describe("FallbackResolver availability checks (integration-light)", () => {
  it("checkProcessAvailability is always true", async () => {
    expect(await resolver.checkProcessAvailability()).toBe(true);
  });

  it("checkDockerAvailability returns boolean (no throw)", async () => {
    const result = await resolver.checkDockerAvailability();
    expect(typeof result).toBe("boolean");
  });

  it("checkPodmanAvailability returns boolean (no throw)", async () => {
    const result = await resolver.checkPodmanAvailability();
    expect(typeof result).toBe("boolean");
  });
});

describe("ToolAvailabilitySchema", () => {
  it("accepts valid object", () => {
    expect(() =>
      ToolAvailabilitySchema.parse({ docker: true, podman: false, process: true }),
    ).not.toThrow();
  });

  it("rejects missing keys", () => {
    expect(() => ToolAvailabilitySchema.parse({ docker: true })).toThrow();
  });

  it("rejects non-boolean values", () => {
    expect(() =>
      ToolAvailabilitySchema.parse({ docker: "yes", podman: false, process: true }),
    ).toThrow();
  });
});
