/**
 * High-level embedding generator with automatic provider selection.
 *
 * Uses ONNX provider when available (ADR-05), falls back to TF-IDF hash-based
 * embeddings for deterministic local operation (ADR-06).
 */

import { logger } from '../utils/logger.js';
import { type EmbeddingProvider, getOnnxProvider, isOnnxAvailable } from './onnx-embeddings.js';

// ── Constants ──

export const EMBEDDING_DIM = 384;
const MAX_TEXT_LENGTH = 10000;

// ── TF-IDF Hash Fallback Provider ──

class HashEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'hash';
  readonly dimensions = EMBEDDING_DIM;

  async generateEmbedding(text: string): Promise<number[]> {
    return hashEmbed(text);
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    return texts.map(t => hashEmbed(t));
  }
}

function hashEmbed(text: string): number[] {
  if (!text || text.trim().length === 0) {
    return new Array<number>(EMBEDDING_DIM).fill(0);
  }

  const truncated = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  const lower = truncated.toLowerCase();

  const vec = new Array<number>(EMBEDDING_DIM).fill(0);

  for (let i = 0; i < lower.length; i++) {
    const c1 = lower.charCodeAt(i);
    const idx1 = ((c1 * 2654435761) >>> 0) % EMBEDDING_DIM;
    vec[idx1] += 1;

    if (i + 1 < lower.length) {
      const c2 = lower.charCodeAt(i + 1);
      const hash = ((c1 * 31 + c2) * 2654435761) >>> 0;
      const idx2 = hash % EMBEDDING_DIM;
      vec[idx2] += 0.5;
    }
  }

  const words = lower.split(/\s+/).filter(Boolean);
  for (const word of words) {
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = ((h * 31 + word.charCodeAt(i)) >>> 0);
    }
    const idx = h % EMBEDDING_DIM;
    vec[idx] += 2;
  }

  let norm = 0;
  for (let d = 0; d < EMBEDDING_DIM; d++) {
    norm += vec[d] * vec[d];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      vec[d] /= norm;
    }
  }

  return vec;
}

// ── Provider cache ──

let cachedProvider: EmbeddingProvider | null = null;
let providerResolved = false;

async function getProvider(): Promise<EmbeddingProvider> {
  if (providerResolved && cachedProvider) return cachedProvider;

  const onnxAvailable = await isOnnxAvailable();
  if (onnxAvailable) {
    try {
      const onnxProvider = await getOnnxProvider('workflow-graph/models');
      if (onnxProvider) {
        cachedProvider = onnxProvider;
        providerResolved = true;
        logger.info('embedding:provider', { name: 'onnx', dim: EMBEDDING_DIM });
        return cachedProvider;
      }
    } catch {
      logger.debug('embedding:onnx-fallback', { reason: 'onnx provider init failed' });
    }
  }

  cachedProvider = new HashEmbeddingProvider();
  providerResolved = true;
  logger.info('embedding:provider', { name: 'hash', dim: EMBEDDING_DIM });
  return cachedProvider;
}

// ── Public API ──

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return new Array<number>(EMBEDDING_DIM).fill(0);
  }

  const truncated = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  const provider = await getProvider();
  return provider.generateEmbedding(truncated);
}

export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider = await getProvider();
  const truncated = texts.map(t =>
    t.length > MAX_TEXT_LENGTH ? t.slice(0, MAX_TEXT_LENGTH) : t,
  );

  const results: number[][] = [];
  const nonEmptyIndices: number[] = [];
  const nonEmptyTexts: string[] = [];

  for (let i = 0; i < truncated.length; i++) {
    if (!truncated[i] || truncated[i].trim().length === 0) {
      results[i] = new Array<number>(EMBEDDING_DIM).fill(0);
    } else {
      nonEmptyIndices.push(i);
      nonEmptyTexts.push(truncated[i]);
    }
  }

  if (nonEmptyTexts.length > 0) {
    const embeddings = await provider.generateBatch(nonEmptyTexts);
    for (let j = 0; j < nonEmptyIndices.length; j++) {
      results[nonEmptyIndices[j]] = embeddings[j];
    }
  }

  return results;
}
