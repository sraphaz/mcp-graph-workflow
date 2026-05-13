/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-autonomy-gap Task 2.5 — ONNX background download
 *
 * AC1: GIVEN nova instalação sem modelo WHEN startOnnxBackgroundDownload THEN download inicia em background + log "Downloading MiniLM-L6-v2 (23MB)..."
 * AC2: GIVEN download em andamento WHEN generateEmbedding THEN usa TF-IDF sem erro
 * AC3: GIVEN download completo WHEN próximo getProvider THEN usa ONNX automaticamente
 * AC4: GIVEN modelo já baixado WHEN startOnnxBackgroundDownload THEN sem download adicional, resolve rápido
 * AC5: GIVEN erro de rede WHEN retry exhausted THEN fallback TF-IDF permanece + onWarning chamado
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { EmbeddingProvider } from "../../core/rag/onnx-embeddings.js";
import {
  startOnnxBackgroundDownload,
  getBackgroundOnnxProvider,
  modelFilesExist,
  _resetBackgroundDownloadState,
} from "../../core/rag/onnx-embeddings.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFakeProvider(name: string): EmbeddingProvider {
  return {
    name,
    dimensions: 384,
    async generateEmbedding(_text: string) { return new Array(384).fill(0.1); },
    async generateBatch(texts: string[]) { return texts.map(() => new Array(384).fill(0.1)); },
  };
}

/** Fast ensureFiles that returns stub paths immediately (no network). */
function makeInstantEnsure(modelPath = "/fake/model.onnx", tokenizerPath = "/fake/tokenizer.json") {
  return async (_modelsDir: string) => ({ modelPath, tokenizerPath });
}

/** ensureFiles that rejects to simulate network failure. */
function makeFailingEnsure(message = "network error") {
  return async (_modelsDir: string): Promise<{ modelPath: string; tokenizerPath: string }> => {
    throw new Error(message);
  };
}

/** ensureFiles that resolves after `delayMs` to simulate slow download. */
function makeSlowEnsure(delayMs: number) {
  return async (_modelsDir: string): Promise<{ modelPath: string; tokenizerPath: string }> => {
    await new Promise(r => setTimeout(r, delayMs));
    return { modelPath: "/fake/model.onnx", tokenizerPath: "/fake/tokenizer.json" };
  };
}

// ── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetBackgroundDownloadState();
});

// ── AC1: background download starts when model absent ────────────────────────

describe("AC1 — background download when model absent", () => {
  it("triggers background download when model files are absent", async () => {
    let downloadCalled = false;
    const ensureFiles = async (_dir: string) => {
      downloadCalled = true;
      return { modelPath: "/fake/model.onnx", tokenizerPath: "/fake/tokenizer.json" };
    };

    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => false, // model absent
      ensureFiles,
    });

    // background download was initiated — give it a tick to run
    await new Promise(r => setTimeout(r, 10));
    expect(downloadCalled).toBe(true);
  });

  it("emits download-start log event when model absent (not a no-op)", () => {
    const logEvents: string[] = [];
    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => false,
      ensureFiles: makeInstantEnsure(),
      onLog: (event: string) => { logEvents.push(event); },
    });

    expect(logEvents.some(e => e.includes("download") || e.includes("Downloading"))).toBe(true);
  });

  it("does NOT trigger download when model files are present", () => {
    let downloadCalled = false;
    const ensureFiles = async (_dir: string) => {
      downloadCalled = true;
      return { modelPath: "/fake/model.onnx", tokenizerPath: "/fake/tokenizer.json" };
    };

    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => true, // model present
      ensureFiles,
    });

    expect(downloadCalled).toBe(false);
  });

  it("returns immediately without blocking the caller", () => {
    const start = Date.now();
    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => false,
      ensureFiles: makeSlowEnsure(5000), // would block for 5s
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100); // returns instantly
  });
});

// ── AC2: TF-IDF used while download in progress ──────────────────────────────

describe("AC2 — TF-IDF available during download", () => {
  it("getBackgroundOnnxProvider returns null while download is pending", async () => {
    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => false,
      ensureFiles: makeSlowEnsure(5000), // still pending
    });

    // Provider should be null — download not done yet
    const provider = getBackgroundOnnxProvider();
    expect(provider).toBeNull();
  });
});

// ── AC3: ONNX auto-switch after download completes ────────────────────────────

describe("AC3 — ONNX auto-available after download completes", () => {
  it("getBackgroundOnnxProvider returns ONNX provider after download resolves", async () => {
    const fakeOnnxProvider = makeFakeProvider("onnx");
    let resolveFn!: () => void;
    const downloadGate = new Promise<void>(r => { resolveFn = r; });

    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => false,
      ensureFiles: async (_dir: string) => {
        await downloadGate;
        return { modelPath: "/fake/model.onnx", tokenizerPath: "/fake/tokenizer.json" };
      },
      makeProvider: (_modelPath: string, _tokenizerPath: string) => fakeOnnxProvider,
    });

    // Before resolve: no provider
    expect(getBackgroundOnnxProvider()).toBeNull();

    // Unblock download
    resolveFn();
    await new Promise(r => setTimeout(r, 20));

    // After resolve: ONNX provider available
    expect(getBackgroundOnnxProvider()).toBe(fakeOnnxProvider);
  });

  it("onReady callback is called with the ONNX provider when download completes", async () => {
    const fakeOnnxProvider = makeFakeProvider("onnx");
    let readyProvider: EmbeddingProvider | null = null;

    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => false,
      ensureFiles: makeInstantEnsure(),
      makeProvider: (_mp: string, _tp: string) => fakeOnnxProvider,
      onReady: (p: EmbeddingProvider) => { readyProvider = p; },
    });

    await new Promise(r => setTimeout(r, 20));
    expect(readyProvider).toBe(fakeOnnxProvider);
  });
});

// ── AC4: model already present — no download, fast path ──────────────────────

describe("AC4 — model already cached", () => {
  it("resolves synchronously to ONNX provider when model files present", async () => {
    const fakeOnnxProvider = makeFakeProvider("onnx");
    let readyProvider: EmbeddingProvider | null = null;

    const start = Date.now();
    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => true,
      ensureFiles: makeInstantEnsure(),
      makeProvider: (_mp: string, _tp: string) => fakeOnnxProvider,
      onReady: (p: EmbeddingProvider) => { readyProvider = p; },
    });

    // Allow microtasks to flush (but no I/O)
    await new Promise(r => setTimeout(r, 10));
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500); // AC4: startup < 500ms
    expect(readyProvider).toBe(fakeOnnxProvider);
  });

  it("modelFilesExist returns false for a non-existent directory", () => {
    const result = modelFilesExist("/tmp/definitely-does-not-exist-xyz-abc");
    expect(result).toBe(false);
  });
});

// ── AC5: error on download — TF-IDF fallback persists ────────────────────────

describe("AC5 — download failure", () => {
  it("getBackgroundOnnxProvider remains null on download error", async () => {
    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => false,
      ensureFiles: makeFailingEnsure("ENOTFOUND huggingface.co"),
    });

    await new Promise(r => setTimeout(r, 20));
    expect(getBackgroundOnnxProvider()).toBeNull();
  });

  it("calls onWarning with error details on download failure", async () => {
    const warnings: string[] = [];

    startOnnxBackgroundDownload("/fake/models", {
      checkExists: () => false,
      ensureFiles: makeFailingEnsure("timeout after 3 retries"),
      onWarning: (msg) => { warnings.push(msg); },
    });

    await new Promise(r => setTimeout(r, 20));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/timeout after 3 retries|download/i);
  });

  it("is idempotent — second call after failure is a no-op", async () => {
    let callCount = 0;
    const ensureFiles = async (_dir: string): Promise<{ modelPath: string; tokenizerPath: string }> => {
      callCount++;
      throw new Error("fail");
    };

    startOnnxBackgroundDownload("/fake/models", { checkExists: () => false, ensureFiles });
    await new Promise(r => setTimeout(r, 20));

    startOnnxBackgroundDownload("/fake/models", { checkExists: () => false, ensureFiles });
    await new Promise(r => setTimeout(r, 20));

    expect(callCount).toBe(1); // second call ignored
  });
});
