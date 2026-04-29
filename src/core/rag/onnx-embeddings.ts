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

/**
 * ONNX Runtime embedding provider for hybrid semantic search.
 *
 * ADR-0055: onnxruntime-node is an optional dependency loaded via dynamic import.
 * ADR-0056: Implements EmbeddingProvider interface for dual-mode embeddings.
 *
 * Model: all-MiniLM-L6-v2 (quantized int8, ~23MB, 384-dim output)
 * Fallback: Returns null when onnxruntime-node is not installed.
 */

import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { OnnxModelNotFoundError } from '../utils/errors.js';
import { TensorBufferPool } from './tensor-buffer-pool.js';
import { downloadFileWithVerify, ChecksumMismatchError, DownloadError } from './model-downloader.js';

// ── Types ──

/** Provider interface for generating embeddings (ADR-0056). */
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
}

// ── Constants ──

const MODEL_NAME = 'all-MiniLM-L6-v2-quantized';
const MODEL_FILENAME = 'model.onnx';
const TOKENIZER_FILENAME = 'tokenizer.json';
const EMBEDDING_DIM = 384;
const MAX_SEQUENCE_LENGTH = 128;

const MODEL_BASE_URL = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx';
const MODEL_URL = `${MODEL_BASE_URL}/model_quantized.onnx`;
const TOKENIZER_URL = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json';
export const DOWNLOAD_TIMEOUT_MS = 20_000;

/**
 * Mean-pool the token embeddings and L2-normalize the result.
 * E3-T04: guards validTokens===0 to avoid NaN (division by zero).
 * Exported for unit testing without loading the ONNX model.
 */
export function meanPoolAndNormalize(
  data: Float32Array,
  validTokens: number,
  dim: number,
): number[] {
  const embedding = new Array<number>(dim).fill(0);
  // E3-T04: when all tokens are masked out, return a zero vector
  if (validTokens === 0) return embedding;

  for (let t = 0; t < validTokens; t++) {
    for (let d = 0; d < dim; d++) {
      embedding[d] += data[t * dim + d];
    }
  }

  let norm = 0;
  for (let d = 0; d < dim; d++) {
    embedding[d] /= validTokens;
    norm += embedding[d] * embedding[d];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let d = 0; d < dim; d++) {
      embedding[d] /= norm;
    }
  }
  return embedding;
}

// ── ONNX availability check ──

let onnxAvailableCache: boolean | null = null;

/** Check if onnxruntime-node is installed and loadable. */
export async function isOnnxAvailable(): Promise<boolean> {
  if (onnxAvailableCache !== null) return onnxAvailableCache;

  try {
    await import('onnxruntime-node');
    onnxAvailableCache = true;
  } catch {
    onnxAvailableCache = false;
    logger.warn('onnx:unavailable', { reason: 'onnxruntime-node not installed — RAG will use hash embeddings (degraded mode)' });
  }

  return onnxAvailableCache;
}

type LogFn = (event: string, fields: Record<string, unknown>) => void;

/**
 * Emit a visible log on daemon boot announcing the active embedding mode.
 * Testable — accepts injected checker and logger functions.
 * Never throws.
 */
export async function logEmbeddingModeOnBoot(
  isAvailable: () => Promise<boolean> = isOnnxAvailable,
  logFn: LogFn = (event, fields) => {
    if (fields.mode === 'neural') {
      logger.info(event, fields);
    } else {
      logger.warn(event, fields);
    }
  },
): Promise<void> {
  try {
    const available = await isAvailable();
    if (available) {
      logFn('rag.embeddings.mode', { mode: 'neural', provider: 'onnxruntime-node/all-MiniLM-L6-v2' });
    } else {
      logFn('rag.embeddings.mode', {
        mode: 'hash',
        hint: 'Opt-in to neural: add onnxruntime-node to optionalDependencies or run `mcp-graph install-neural`',
      });
    }
  } catch {
    logFn('rag.embeddings.mode', { mode: 'hash', hint: 'ONNX check failed — using hash embeddings' });
  }
}

// ── Directory bootstrap ──

/** Ensure the models root directory exists (creates it recursively if absent). */
export function ensureOnnxModelDir(modelsDir: string): void {
  mkdirSync(modelsDir, { recursive: true });
}

// ── Model download ──

async function downloadFile(url: string, destPath: string): Promise<void> {
  // §EPIC-17.T01 — delegated to model-downloader. expectedSha256 is omitted
  // for now (pinned hashes will be set in T05 once first canonical download
  // is captured); mismatch detection is still active when caller passes one.
  try {
    const result = await downloadFileWithVerify(url, destPath);
    logger.info('onnx:download:ok', {
      dest: destPath,
      sizeBytes: result.sizeBytes,
      sha256: result.sha256,
      verified: result.verified,
    });
  } catch (err) {
    if (err instanceof ChecksumMismatchError) {
      throw new OnnxModelNotFoundError(`Checksum mismatch for ${url}: ${err.message}`);
    }
    if (err instanceof DownloadError) {
      throw new OnnxModelNotFoundError(`Failed to download: ${url} — ${err.message}`);
    }
    throw err;
  }
}

async function ensureModelFiles(modelsDir: string): Promise<{ modelPath: string; tokenizerPath: string }> {
  const modelDir = join(modelsDir, MODEL_NAME);
  const modelPath = join(modelDir, MODEL_FILENAME);
  const tokenizerPath = join(modelDir, TOKENIZER_FILENAME);

  // Validate file integrity — delete corrupted/truncated files
  const MIN_MODEL_SIZE = 1024; // 1KB minimum for a valid ONNX model
  if (existsSync(modelPath)) {
    const size = statSync(modelPath).size;
    if (size < MIN_MODEL_SIZE) {
      logger.warn('onnx:corrupted-model', { modelPath, sizeBytes: size, minRequired: MIN_MODEL_SIZE });
      unlinkSync(modelPath);
    }
  }
  if (existsSync(tokenizerPath)) {
    try {
      const raw = readFileSync(tokenizerPath, 'utf-8');
      JSON.parse(raw); // validate JSON integrity
    } catch {
      logger.warn('onnx:corrupted-tokenizer', { tokenizerPath });
      unlinkSync(tokenizerPath);
    }
  }

  if (existsSync(modelPath) && existsSync(tokenizerPath)) {
    logger.debug('onnx:cache-hit', { modelDir });
    return { modelPath, tokenizerPath };
  }

  mkdirSync(modelDir, { recursive: true });

  if (!existsSync(modelPath)) {
    await downloadFile(MODEL_URL, modelPath);
  }
  if (!existsSync(tokenizerPath)) {
    await downloadFile(TOKENIZER_URL, tokenizerPath);
  }

  return { modelPath, tokenizerPath };
}

// ── Simple tokenizer ──

interface TokenizerConfig {
  model: {
    vocab: Record<string, number>;
  };
}

function loadTokenizer(tokenizerPath: string): TokenizerConfig | null {
  try {
    const raw = readFileSync(tokenizerPath, 'utf-8');
    return JSON.parse(raw) as TokenizerConfig;
  } catch (err) {
    logger.warn('onnx:tokenizer-load-failed', { tokenizerPath, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function tokenize(text: string, vocab: Record<string, number>): number[] {
  const CLS = vocab['[CLS]'] ?? 101;
  const SEP = vocab['[SEP]'] ?? 102;
  const UNK = vocab['[UNK]'] ?? 100;

  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const tokenIds: number[] = [CLS];

  for (const word of words) {
    const id = vocab[word];
    if (id !== undefined) {
      tokenIds.push(id);
    } else {
      for (const char of word) {
        tokenIds.push(vocab[char] ?? UNK);
      }
    }
    if (tokenIds.length >= MAX_SEQUENCE_LENGTH - 1) break;
  }

  tokenIds.push(SEP);
  return tokenIds.slice(0, MAX_SEQUENCE_LENGTH);
}

// ── ONNX Provider ──

class OnnxEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'onnx';
  readonly dimensions = EMBEDDING_DIM;

  private session: unknown = null;
  private vocab: Record<string, number> = {};
  private readonly bufferPool = new TensorBufferPool(4);

  constructor(
    private readonly modelPath: string,
    private readonly tokenizerPath: string,
  ) {}

  private async getSession(): Promise<unknown> {
    if (this.session) return this.session;

    const ort = await import('onnxruntime-node');
    this.session = await ort.InferenceSession.create(this.modelPath);

    const config = loadTokenizer(this.tokenizerPath);
    if (!config) {
      throw new OnnxModelNotFoundError(`Failed to load tokenizer: ${this.tokenizerPath}`);
    }
    this.vocab = config.model?.vocab ?? {};

    logger.info('onnx:session-created', { model: this.modelPath });
    return this.session;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const session = await this.getSession() as {
      run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>>;
    };

    const ort = await import('onnxruntime-node');
    const tokenIds = tokenize(text, this.vocab);
    const validTokenCount = tokenIds.length;

    const { slot, release } = await this.bufferPool.acquire();
    try {
      // Fill pre-allocated buffers in-place — zero heap alloc per call
      for (let i = 0; i < MAX_SEQUENCE_LENGTH; i++) {
        slot.inputIds[i] = BigInt(tokenIds[i] ?? 0);
        slot.attentionMask[i] = i < validTokenCount ? 1n : 0n;
        slot.tokenTypeIds[i] = 0n;
      }

      const inputIdsTensor = new ort.Tensor('int64', slot.inputIds, [1, MAX_SEQUENCE_LENGTH]);
      const attentionTensor = new ort.Tensor('int64', slot.attentionMask, [1, MAX_SEQUENCE_LENGTH]);
      const typeIdsTensor = new ort.Tensor('int64', slot.tokenTypeIds, [1, MAX_SEQUENCE_LENGTH]);

      const results = await session.run({
        input_ids: inputIdsTensor,
        attention_mask: attentionTensor,
        token_type_ids: typeIdsTensor,
      });

      const lastHidden = results['last_hidden_state'] ?? results['output'];
      if (!lastHidden?.data) {
        throw new OnnxModelNotFoundError('Model output missing last_hidden_state');
      }

      const data = lastHidden.data as Float32Array;
      return meanPoolAndNormalize(data, validTokenCount, EMBEDDING_DIM);
    } finally {
      release();
    }
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.generateEmbedding(text));
    }
    return results;
  }
}

// ── Public API ──

/**
 * Module-level cache of in-flight / resolved providers keyed by `modelsDir`.
 * A fresh ONNX session + tokenizer vocab costs ~23MB — without this cache, any
 * code that calls `getOnnxProvider` more than once (across agents, routers,
 * background indexers) would load duplicate models into the same process.
 *
 * Promise-based so concurrent callers share a single initialization; on
 * rejection the entry is evicted to allow a retry on the next call.
 */
const providerCache = new Map<string, Promise<EmbeddingProvider>>();

export async function getOnnxProvider(modelsDir: string): Promise<EmbeddingProvider | null> {
  const available = await isOnnxAvailable();
  if (!available) {
    logger.warn('onnx:provider-degraded', { available: false, impact: 'RAG operates with hash embeddings instead of neural — lower search quality' });
    return null;
  }

  const existing = providerCache.get(modelsDir);
  if (existing) {
    try {
      return await existing;
    } catch {
      providerCache.delete(modelsDir);
    }
  }

  const creation = (async () => {
    const { modelPath, tokenizerPath } = await ensureModelFiles(modelsDir);
    return new OnnxEmbeddingProvider(modelPath, tokenizerPath);
  })();

  providerCache.set(modelsDir, creation);

  try {
    return await creation;
  } catch (err) {
    providerCache.delete(modelsDir);
    logger.error('onnx:provider-init-failed', { error: err instanceof Error ? err.message : String(err) });
    logger.warn('onnx:fallback', {
      reason: err instanceof Error ? err.message : String(err),
      action: 'return-null-provider',
      modelsDir,
    });
    return null;
  }
}
