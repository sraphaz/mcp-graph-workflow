/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T10 — Batch Coalescer.
 *
 * Groups N independent calls submitted within a small time window into a
 * single batched executor call, then demuxes results back to each caller.
 * Flushes when the window timer fires OR the batch reaches maxBatchSize,
 * whichever comes first.
 */

export interface BatchCoalescerOptions<I, O> {
  /** Max items per batch — triggers an early flush when reached. */
  maxBatchSize: number;
  /** Window in milliseconds — triggers flush after this idle time. */
  windowMs: number;
  /** Batch executor. MUST return an array with the same length as `items`. */
  executor: (items: I[]) => Promise<O[]>;
}

interface PendingItem<I, O> {
  input: I;
  resolve: (out: O) => void;
  reject: (err: unknown) => void;
}

export class BatchCoalescer<I, O> {
  private readonly opts: BatchCoalescerOptions<I, O>;
  private pending: PendingItem<I, O>[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: BatchCoalescerOptions<I, O>) {
    this.opts = opts;
  }

  submit(input: I): Promise<O> {
    return new Promise<O>((resolve, reject) => {
      this.pending.push({ input, resolve, reject });
      if (this.pending.length >= this.opts.maxBatchSize) {
        void this.flush();
      } else if (this.timer === null) {
        this.timer = setTimeout(() => void this.flush(), this.opts.windowMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = this.pending;
    if (batch.length === 0) return;
    this.pending = [];

    const inputs = batch.map((p) => p.input);
    try {
      const outputs = await this.opts.executor(inputs);
      if (outputs.length !== inputs.length) {
        const err = new Error(
          `BatchCoalescer: length mismatch — executor returned ${outputs.length} for ${inputs.length} inputs`,
        );
        for (const p of batch) p.reject(err);
        return;
      }
      batch.forEach((p, i) => p.resolve(outputs[i]));
    } catch (err) {
      for (const p of batch) p.reject(err);
    }
  }
}
