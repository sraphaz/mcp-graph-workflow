/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Story 5: Trace/correlation ID propagation
 * AsyncLocalStorage store — propagates traceId + spanId across awaits within a request.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface TraceContext {
  traceId: string;
  spanId: string;
}

const store = new AsyncLocalStorage<TraceContext>();

export function getTraceContext(): TraceContext | undefined {
  return store.getStore();
}

export function runWithTrace<T>(traceId: string, spanId: string, fn: () => T): T {
  return store.run({ traceId, spanId }, fn);
}
