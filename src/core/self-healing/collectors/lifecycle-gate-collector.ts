/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 1.3: collector source=lifecycle_gate
 *
 * Enqueues a FailureSignal when the lifecycle gate blocks a tool call.
 * Called from unified-gate.ts at the gate-block path.
 */

import type { FailureSignalCollector } from "../failure-signal-collector.js";

export function collectLifecycleGateBlock(
  toolName: string,
  phase: string,
  collector: FailureSignalCollector,
): void {
  collector.record({
    source: "lifecycle_gate",
    signalKind: "gate_blocked",
    context: { toolName, phase },
    severity: "warn",
    timestamp: new Date().toISOString(),
  });
}
