/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 1.2: SSE coalescer (max 10 evt/s per run).
 *
 * Buffers pushed events per runId and flushes at most `maxPerWindow` entries
 * every `windowMs` milliseconds, preventing floods from overwhelming clients.
 */

export interface CoalescedEvent {
  type: string;
  runId: string;
  payload: unknown;
}

type FlushCallback = (events: CoalescedEvent[]) => void;

export class EventCoalescer {
  private readonly buffer = new Map<string, CoalescedEvent[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private readonly windowMs: number,
    private readonly onFlush: FlushCallback,
    private readonly maxPerWindow = 10,
  ) {}

  push(event: CoalescedEvent): void {
    if (this.destroyed) return;

    const bucket = this.buffer.get(event.runId) ?? [];
    bucket.push(event);
    this.buffer.set(event.runId, bucket);

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.windowMs);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.buffer.clear();
  }

  private flush(): void {
    this.timer = null;
    if (this.destroyed) return;

    const batch: CoalescedEvent[] = [];
    for (const [id, events] of this.buffer) {
      batch.push(...events.slice(0, this.maxPerWindow));
      this.buffer.delete(id);
    }

    if (batch.length > 0) {
      this.onFlush(batch);
    }
  }
}
