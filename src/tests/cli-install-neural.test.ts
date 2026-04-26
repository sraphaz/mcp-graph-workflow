/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * TDD for `mcp-graph install-neural` — opt-in for ONNX neural embeddings.
 *
 * The CLI delegates to a pure orchestration function in
 * `src/core/install-neural/install-neural.ts` so the orchestration can
 * be tested without spawning a real `npm install` or hitting the
 * network. The CLI command itself is a thin Commander wrapper.
 */

import { describe, expect, it, vi } from "vitest";
import {
  runInstallNeural,
  type InstallNeuralDeps,
  type InstallNeuralResult,
} from "../core/install-neural/install-neural.js";

function makeDeps(overrides: Partial<InstallNeuralDeps> = {}): InstallNeuralDeps {
  return {
    npmInstall: vi.fn().mockResolvedValue({ ok: true, durationMs: 100 }),
    downloadModel: vi.fn().mockResolvedValue({ ok: true, modelsDir: "/fake/models" }),
    isOnnxAvailable: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("runInstallNeural", () => {
  it("installs onnxruntime-node, downloads the model, and confirms availability", async () => {
    const deps = makeDeps();

    const result = await runInstallNeural({ dryRun: false, modelsDir: "/fake/models" }, deps);

    expect(deps.npmInstall).toHaveBeenCalledWith("onnxruntime-node");
    expect(deps.downloadModel).toHaveBeenCalledWith("/fake/models");
    expect(deps.isOnnxAvailable).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ready");
    expect(result.steps.npmInstall).toBe("ok");
    expect(result.steps.downloadModel).toBe("ok");
    expect(result.steps.verify).toBe("ok");
  });

  it("dry-run reports planned actions without executing them", async () => {
    const deps = makeDeps();

    const result = await runInstallNeural({ dryRun: true, modelsDir: "/fake/models" }, deps);

    expect(deps.npmInstall).not.toHaveBeenCalled();
    expect(deps.downloadModel).not.toHaveBeenCalled();
    expect(deps.isOnnxAvailable).not.toHaveBeenCalled();
    expect(result.status).toBe("dry-run");
    expect(result.plannedActions).toEqual([
      "npm install onnxruntime-node",
      "download all-MiniLM-L6-v2 model to /fake/models",
      "verify ONNX provider availability",
    ]);
  });

  it("returns failed when npm install fails — does not attempt download", async () => {
    const deps = makeDeps({
      npmInstall: vi.fn().mockResolvedValue({ ok: false, error: "ENOENT: npm not found" }),
    });

    const result = await runInstallNeural({ dryRun: false, modelsDir: "/fake/models" }, deps);

    expect(deps.downloadModel).not.toHaveBeenCalled();
    expect(deps.isOnnxAvailable).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
    expect(result.steps.npmInstall).toBe("failed");
    expect(result.error).toContain("npm not found");
  });

  it("returns failed when model download fails — does not attempt verify", async () => {
    const deps = makeDeps({
      downloadModel: vi.fn().mockResolvedValue({ ok: false, error: "network timeout" }),
    });

    const result = await runInstallNeural({ dryRun: false, modelsDir: "/fake/models" }, deps);

    expect(deps.isOnnxAvailable).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
    expect(result.steps.npmInstall).toBe("ok");
    expect(result.steps.downloadModel).toBe("failed");
    expect(result.error).toContain("network timeout");
  });

  it("returns degraded when verify reports ONNX still unavailable post-install", async () => {
    const deps = makeDeps({
      isOnnxAvailable: vi.fn().mockResolvedValue(false),
    });

    const result = await runInstallNeural({ dryRun: false, modelsDir: "/fake/models" }, deps);

    expect(result.status).toBe("degraded");
    expect(result.steps.verify).toBe("failed");
    expect(result.error).toMatch(/unavailable/i);
  });

  it("typed result is structurally complete", async () => {
    const deps = makeDeps();
    const result: InstallNeuralResult = await runInstallNeural(
      { dryRun: false, modelsDir: "/fake/models" },
      deps,
    );

    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("steps");
    expect(result.steps).toHaveProperty("npmInstall");
    expect(result.steps).toHaveProperty("downloadModel");
    expect(result.steps).toHaveProperty("verify");
  });
});
