/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * OCR complement for journey step screenshots. Uses tesseract.js (pure-JS
 * WASM, no native binary) so the pipeline stays frontend-agnostic — works
 * for React, Vue, Angular, Siebel, canvas-heavy, iframe-heavy, and
 * Shadow-DOM apps where DOM text extraction is unreliable.
 *
 * Lazy-loaded: the worker is only spun up on first `recognise()` call and
 * kept warm afterwards. Callers should `terminate()` on shutdown.
 */

import { logger } from "../utils/logger.js";

const DOM_TEXT_SUFFICIENT_CHARS = 20;

export interface OcrOptions {
  /** Tesseract language string, e.g. "eng", "por", or "eng+por". */
  lang?: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Decide whether OCR should run for a given step.
 * - Not a screenshot helper? Skip — there's nothing to recognise.
 * - DOM already has ≥ 20 non-whitespace chars of text? Skip — OCR won't add.
 * - Otherwise run OCR to complement the DOM.
 */
export function shouldOcr(helper: string, domText: string | null): boolean {
  if (helper !== "screenshot") return false;
  const trimmed = (domText ?? "").trim();
  return trimmed.length < DOM_TEXT_SUFFICIENT_CHARS;
}

interface WorkerLike {
  recognize: (input: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<void>;
}

export class OcrService {
  private worker: WorkerLike | null = null;
  private loading: Promise<WorkerLike> | null = null;

  constructor(private readonly opts: OcrOptions = {}) {}

  isLoaded(): boolean {
    return this.worker !== null;
  }

  async recognise(pngBytes: Buffer): Promise<OcrResult> {
    const worker = await this.ensureWorker();
    try {
      const { data } = await worker.recognize(pngBytes);
      return { text: data.text.trim(), confidence: data.confidence };
    } catch (err) {
      logger.warn("journey:ocr:recognise:fail", { error: err instanceof Error ? err.message : String(err) });
      return { text: "", confidence: 0 };
    }
  }

  async terminate(): Promise<void> {
    if (!this.worker) return;
    const w = this.worker;
    this.worker = null;
    this.loading = null;
    try {
      await w.terminate();
    } catch (err) {
      logger.debug("journey:ocr:terminate:fail", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async ensureWorker(): Promise<WorkerLike> {
    if (this.worker) return this.worker;
    if (this.loading) return this.loading;
    this.loading = this.spawnWorker();
    try {
      this.worker = await this.loading;
      return this.worker;
    } finally {
      this.loading = null;
    }
  }

  private async spawnWorker(): Promise<WorkerLike> {
    const lang = this.opts.lang ?? "eng";
    logger.info("journey:ocr:spawn", { lang });
    const mod = await import("tesseract.js");
    const createWorker = (mod as unknown as {
      createWorker: (lang: string) => Promise<WorkerLike>;
    }).createWorker;
    return createWorker(lang);
  }
}
