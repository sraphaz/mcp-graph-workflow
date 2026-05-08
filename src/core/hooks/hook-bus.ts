/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { createLogger } from "../utils/logger.js";
import type { GraphEventBus } from "../events/event-bus.js";
import type { HookChannel, HookEvent, HookHandler } from "./hook-types.js";

const log = createLogger({ layer: "core", source: "hook-bus.ts" });

/**
 * Typed pub/sub layer for hook events.
 * Composes GraphEventBus (injected) but routes hook channels independently
 * so hook emissions never bleed into the graph event stream.
 */
export class HookBus {
  private readonly handlers = new Map<HookChannel, Set<HookHandler>>();

  constructor(private readonly graphBus: GraphEventBus) {}

  on(channel: HookChannel, handler: HookHandler): void {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
    }
    set.add(handler);
  }

  off(channel: HookChannel, handler: HookHandler): void {
    this.handlers.get(channel)?.delete(handler);
  }

  async emit(event: HookEvent): Promise<void> {
    const set = this.handlers.get(event.channel);
    if (!set || set.size === 0) return;
    for (const handler of set) {
      try {
        await handler(event);
      } catch (err) {
        log.error("Hook handler error", {
          channel: event.channel,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  listenerCount(channel: HookChannel): number {
    return this.handlers.get(channel)?.size ?? 0;
  }

  /** Expose the underlying GraphEventBus for cross-cutting use */
  get bus(): GraphEventBus {
    return this.graphBus;
  }
}
