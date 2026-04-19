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

import { EventEmitter } from "node:events";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { GraphEvent, GraphEventType } from "./event-types.js";

type EventHandler = (event: GraphEvent) => void;
type EventType = GraphEventType | "*";

/**
 * Typed event bus for graph mutations.
 * Wraps Node.js EventEmitter with typed GraphEvent payloads.
 */
export class GraphEventBus {
  private emitter = new EventEmitter();
  private wrappedHandlers = new Map<string, Map<EventHandler, EventHandler>>();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  /** Emit a graph event with error boundaries — one crashing handler won't stop others */
  emit(event: GraphEvent): void {
    if (!event || !event.type) {
      throw new McpGraphError("Cannot emit event without type");
    }
    logger.info("Event emitted", { type: event.type });
    this.emitter.emit(event.type, event);
    this.emitter.emit("*", event);
  }

  /** Listen for a specific event type */
  on(type: EventType, handler: EventHandler): void {
    this.emitter.on(type, this.wrapHandler(type, handler));
  }

  /** Listen for a specific event type (once) */
  once(type: EventType, handler: EventHandler): void {
    this.emitter.once(type, this.wrapHandler(type, handler));
  }

  /** Remove a specific listener */
  off(type: EventType, handler: EventHandler): void {
    const wrapped = this.getWrappedHandler(type, handler);
    this.emitter.off(type, wrapped ?? handler);
    this.deleteWrappedHandler(type, handler);
  }

  /** Remove all listeners */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
    this.wrappedHandlers.clear();
  }

  /** Get listener count for a type */
  listenerCount(type: EventType): number {
    return this.emitter.listenerCount(type);
  }

  /** Helper: create and emit event in one call */
  emitTyped(type: GraphEventType, payload: Record<string, unknown>): void {
    this.emit({
      type,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  private wrapHandler(type: EventType, handler: EventHandler): EventHandler {
    const existing = this.getWrappedHandler(type, handler);
    if (existing) return existing;

    const wrapped: EventHandler = (event) => {
      try {
        handler(event);
      } catch (err) {
        logger.error("Event handler crashed", {
          type: event.type,
          listenerType: type,
          error: err instanceof Error ? err.message : String(err),
        });
        this.off(type, handler);
      }
    };

    const key = String(type);
    let handlers = this.wrappedHandlers.get(key);
    if (!handlers) {
      handlers = new Map<EventHandler, EventHandler>();
      this.wrappedHandlers.set(key, handlers);
    }
    handlers.set(handler, wrapped);
    return wrapped;
  }

  private getWrappedHandler(type: EventType, handler: EventHandler): EventHandler | undefined {
    return this.wrappedHandlers.get(String(type))?.get(handler);
  }

  private deleteWrappedHandler(type: EventType, handler: EventHandler): void {
    const key = String(type);
    const handlers = this.wrappedHandlers.get(key);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.wrappedHandlers.delete(key);
    }
  }
}
