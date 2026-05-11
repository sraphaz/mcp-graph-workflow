/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Story 5: Trace/correlation ID propagation
 * MCP-layer utility: returns the caller-provided traceId or generates a new one.
 */

import { randomBytes } from "node:crypto";

function generateTraceId(): string {
  const ts = Date.now().toString(36).padStart(9, "0");
  const rnd = randomBytes(8).toString("hex");
  return `${ts}${rnd}`;
}

export function resolveTraceId(traceId: string | undefined): string {
  return traceId !== undefined && traceId.length > 0 ? traceId : generateTraceId();
}
