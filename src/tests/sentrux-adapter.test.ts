/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — Detecção de presença com soft-fail
 *
 * AC1: GIVEN Sentrux instalado WHEN rodo detect THEN retorna {available: true, version: "..."}
 * AC2: GIVEN Sentrux ausente WHEN rodo detect THEN retorna {available: false, hint: "brew install ..."}
 * AC3: GIVEN soft-fail acionado WHEN inspeciono log THEN warn estruturado, sem throw
 */

import { describe, it, expect } from "vitest";
import { detectSentrux } from "../core/integrations/sentrux-adapter.js";

const installedExec = async (_cmd: string, _args: string[]) =>
  ({ stdout: "sentrux 1.2.3\n" });

const absentExec = async (_cmd: string, _args: string[]): Promise<{ stdout: string }> => {
  throw Object.assign(new Error("command not found: sentrux"), { code: "ENOENT" });
};

// ---------------------------------------------------------------------------
// AC1: installed → {available: true, version}
// ---------------------------------------------------------------------------

describe("detectSentrux — AC1: installed", () => {
  it("returns available: true when sentrux is installed", async () => {
    const result = await detectSentrux(installedExec);
    expect(result.available).toBe(true);
  });

  it("includes the version string", async () => {
    const result = await detectSentrux(installedExec);
    if (!result.available) throw new Error("expected available");
    expect(result.version).toBe("sentrux 1.2.3");
  });

  it("trims whitespace from version output", async () => {
    const execWithSpaces = async () => ({ stdout: "  1.0.0  \n" });
    const result = await detectSentrux(execWithSpaces);
    if (!result.available) throw new Error("expected available");
    expect(result.version).toBe("1.0.0");
  });
});

// ---------------------------------------------------------------------------
// AC2: absent → {available: false, hint}
// ---------------------------------------------------------------------------

describe("detectSentrux — AC2: absent", () => {
  it("returns available: false when sentrux is not found", async () => {
    const result = await detectSentrux(absentExec);
    expect(result.available).toBe(false);
  });

  it("includes a brew install hint", async () => {
    const result = await detectSentrux(absentExec);
    if (result.available) throw new Error("expected unavailable");
    expect(result.hint).toContain("sentrux");
    expect(result.hint).toContain("brew");
  });
});

// ---------------------------------------------------------------------------
// AC3: soft-fail — never throws
// ---------------------------------------------------------------------------

describe("detectSentrux — AC3: soft-fail never throws", () => {
  it("does not throw when exec fails", async () => {
    await expect(detectSentrux(absentExec)).resolves.toBeDefined();
  });

  it("always returns an object (never undefined)", async () => {
    const result = await detectSentrux(absentExec);
    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("available");
  });

  it("does not throw even on unexpected error", async () => {
    const crashExec = async (): Promise<{ stdout: string }> => {
      throw new Error("unexpected crash");
    };
    await expect(detectSentrux(crashExec)).resolves.not.toThrow();
  });
});
