/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkOnnxStatusWith } from "../../core/doctor/doctor-checks.js";
import { logEmbeddingModeOnBoot } from "../../core/rag/onnx-embeddings.js";

describe("checkOnnxStatus — doctor check", () => {
  it("returns warning with actionable instruction when onnxruntime-node unavailable", async () => {
    const result = await checkOnnxStatusWith(async () => false);
    expect(result.name).toBe("onnx_status");
    expect(result.level).toBe("warning");
    expect(result.message).toContain("unavailable");
    expect(result.suggestion).toBeDefined();
    expect(result.suggestion).toMatch(/optionalDependencies|install-neural/);
  });

  it("returns ok when onnxruntime-node is available", async () => {
    const result = await checkOnnxStatusWith(async () => true);
    expect(result.name).toBe("onnx_status");
    expect(result.level).toBe("ok");
    expect(result.message).toContain("neural");
  });
});

describe("logEmbeddingModeOnBoot — startup log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits rag.embeddings.mode=neural when onnxruntime-node available", async () => {
    const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];
    await logEmbeddingModeOnBoot(async () => true, (event, fields) => logs.push({ event, fields }));
    const infoLog = logs.find((l) => l.event === "rag.embeddings.mode");
    expect(infoLog).toBeDefined();
    expect(infoLog?.fields.mode).toBe("neural");
  });

  it("emits rag.embeddings.mode=hash with opt-in link when onnxruntime-node absent", async () => {
    const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];
    await logEmbeddingModeOnBoot(async () => false, (event, fields) => logs.push({ event, fields }));
    const warnLog = logs.find((l) => l.event === "rag.embeddings.mode");
    expect(warnLog).toBeDefined();
    expect(warnLog?.fields.mode).toBe("hash");
    expect(String(warnLog?.fields.hint ?? "")).toMatch(/optionalDependencies|install-neural/);
  });

  it("never throws even if availability check rejects", async () => {
    await expect(
      logEmbeddingModeOnBoot(async () => { throw new Error("network error"); }),
    ).resolves.not.toThrow();
  });
});
