/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-browser-resilience — typed event bus for the browser harness
 * (browser-use inspiration). Replaces the polling loop with an
 * EventEmitter-based dispatch so multiple watchdogs can react in
 * parallel to the same browser-side event without contending on a
 * single tick.
 */

import { EventEmitter } from "node:events";

/**
 * Discriminated union of every event the harness emits. New event kinds
 * must be added here (and to `BrowserEventName`) so handlers stay typed.
 */
export type BrowserEvent =
  | { kind: "page.load"; targetId: string; url: string; ts: number }
  | { kind: "page.blank"; targetId: string; ts: number }
  | { kind: "dom.mutation"; targetId: string; addedNodes: number; ts: number }
  | { kind: "dialog.open"; targetId: string; dialogType: "alert" | "confirm" | "prompt" | "beforeunload"; message: string; ts: number }
  | { kind: "download.start"; targetId: string; suggestedFilename: string; ts: number }
  | { kind: "download.complete"; targetId: string; path: string; ts: number }
  | { kind: "navigation.cross_origin"; targetId: string; fromOrigin: string; toOrigin: string; ts: number }
  | { kind: "tab.created"; targetId: string; ts: number }
  | { kind: "tab.closed"; targetId: string; ts: number };

export type BrowserEventName = BrowserEvent["kind"];

export type BrowserEventOf<K extends BrowserEventName> = Extract<BrowserEvent, { kind: K }>;

/**
 * Watchdogs subscribe to one or more event kinds and return a verdict
 * the harness can act on (advisory log, action like dismiss-dialog,
 * or block).
 */
export interface WatchdogVerdict {
  watchdog: string;
  level: "info" | "warn" | "block";
  message: string;
  /** §extracta — optional structured action the harness can apply. */
  action?: { type: string; [k: string]: unknown };
}

export type WatchdogHandler<K extends BrowserEventName = BrowserEventName> = (
  event: BrowserEventOf<K>,
) => WatchdogVerdict | undefined | Promise<WatchdogVerdict | undefined>;

/**
 * Thin wrapper over node:events giving the harness a typed surface.
 * `dispatch()` runs every registered handler for the event kind in
 * parallel and returns the verdicts (in registration order).
 */
export class BrowserEventBus {
  private readonly emitter = new EventEmitter();
  private readonly handlersByKind = new Map<BrowserEventName, Array<{ name: string; fn: WatchdogHandler }>>();

  on<K extends BrowserEventName>(kind: K, watchdogName: string, handler: WatchdogHandler<K>): () => void {
    const list = this.handlersByKind.get(kind) ?? [];
    const entry = { name: watchdogName, fn: handler as unknown as WatchdogHandler };
    list.push(entry);
    this.handlersByKind.set(kind, list);
    return () => {
      const cur = this.handlersByKind.get(kind);
      if (!cur) return;
      const idx = cur.indexOf(entry);
      if (idx !== -1) cur.splice(idx, 1);
    };
  }

  /**
   * Run every handler for `event.kind` in parallel. Verdicts are returned
   * in registration order. Handler exceptions are caught and surfaced as
   * `level: "warn"` verdicts so a single bad watchdog never crashes the
   * dispatch.
   */
  async dispatch(event: BrowserEvent): Promise<WatchdogVerdict[]> {
    const handlers = this.handlersByKind.get(event.kind) ?? [];
    const results = await Promise.all(
      handlers.map(async ({ name, fn }) => {
        try {
          const vVar = await fn(event);
          return vVar ?? null;
        } catch (err) {
          return {
            watchdog: name,
            level: "warn" as const,
            message: `watchdog crashed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }),
    );
    this.emitter.emit(event.kind, event);
    return results.filter((v): v is WatchdogVerdict => v !== null);
  }

  watchdogCount(kind: BrowserEventName): number {
    return this.handlersByKind.get(kind)?.length ?? 0;
  }
}
