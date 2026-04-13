/**
 * ONNX Runtime embedding provider for hybrid semantic search.
 *
 * ADR-05: onnxruntime-node is an optional dependency loaded via dynamic import.
 * ADR-06: Implements EmbeddingProvider interface for dual-mode embeddings.
 *
 * Model: all-MiniLM-L6-v2 (quantized int8, ~23MB, 384-dim output)
 * Fallback: Returns null when onnxruntime-node is not installed.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { OnnxModelNotFoundError } from '../utils/errors.js';

// ── Types ──

/** Provider interface for generating embeddings (ADR-06). */
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
    logger.debug('onnx:check', { available: false, reason: 'onnxruntime-node not installed' });
  }

  return onnxAvailableCache;
}

// ── Model download ──

async function downloadFile(url: string, destPath: string): Promise<void> {
  logger.info('onnx:download', { url, dest: destPath });

  const response = await fetch(url);
  if (!response.ok) {
    throw new OnnxModelNotFoundError(`Failed to download: ${url} (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destPath, buffer);
  logger.info('onnx:download:ok', { dest: destPath, sizeBytes: buffer.length });
}

async function ensureModelFiles(modelsDir: string): Promise<{ modelPath: string; tokenizerPath: string }> {
  const modelDir = join(modelsDir, MODEL_NAME);
  const modelPath = join(modelDir, MODEL_FILENAME);
  const tokenizerPath = join(modelDir, TOKENIZER_FILENAME);

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

function loadTokenizer(tokenizerPath: string): TokenizerConfig {
  const raw = readFileSync(tokenizerPath, 'utf-8');
  return JSON.parse(raw) as TokenizerConfig;
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

  constructor(
    private readonly modelPath: string,
    private readonly tokenizerPath: string,
  ) {}

  private async getSession(): Promise<unknown> {
    if (this.session) return this.session;

    const ort = await import('onnxruntime-node');
    this.session = await ort.InferenceSession.create(this.modelPath);

    const config = loadTokenizer(this.tokenizerPath);
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
    const attentionMask = tokenIds.map(() => 1);
    const tokenTypeIds = tokenIds.map(() => 0);

    while (tokenIds.length < MAX_SEQUENCE_LENGTH) {
      tokenIds.push(0);
      attentionMask.push(0);
      tokenTypeIds.push(0);
    }

    const inputIds = new ort.Tensor('int64', BigInt64Array.from(tokenIds.map(BigInt)), [1, MAX_SEQUENCE_LENGTH]);
    const attention = new ort.Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, MAX_SEQUENCE_LENGTH]);
    const typeIds = new ort.Tensor('int64', BigInt64Array.from(tokenTypeIds.map(BigInt)), [1, MAX_SEQUENCE_LENGTH]);

    const results = await session.run({
      input_ids: inputIds,
      attention_mask: attention,
      token_type_ids: typeIds,
    });

    const lastHidden = results['last_hidden_state'] ?? results['output'];
    if (!lastHidden?.data) {
      throw new OnnxModelNotFoundError('Model output missing last_hidden_state');
    }

    const data = lastHidden.data as Float32Array;
    const embedding = new Array<number>(EMBEDDING_DIM).fill(0);
    const validTokens = attentionMask.filter(m => m === 1).length;

    for (let t = 0; t < validTokens; t++) {
      for (let d = 0; d < EMBEDDING_DIM; d++) {
        embedding[d] += data[t * EMBEDDING_DIM + d];
      }
    }

    let norm = 0;
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      embedding[d] /= validTokens;
      norm += embedding[d] * embedding[d];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let d = 0; d < EMBEDDING_DIM; d++) {
        embedding[d] /= norm;
      }
    }

    return embedding;
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

export async function getOnnxProvider(modelsDir: string): Promise<EmbeddingProvider | null> {
  const available = await isOnnxAvailable();
  if (!available) {
    logger.debug('onnx:provider', { available: false });
    return null;
  }

  try {
    const { modelPath, tokenizerPath } = await ensureModelFiles(modelsDir);
    return new OnnxEmbeddingProvider(modelPath, tokenizerPath);
  } catch (err) {
    logger.error('onnx:provider-init-failed', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
