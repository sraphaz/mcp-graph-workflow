/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 1.3: collector source=dod_check
 *
 * Enqueues a FailureSignal when a DoD check fails in finish_task / analyze(implement_done).
 */

import type { FailureSignalCollector } from "../failure-signal-collector.js";

export function collectDodCheckFailure(
  nodeId: string,
  failedChecks: string[],
  collector: FailureSignalCollector,
): void {
  collector.record({
    source: "dod_check",
    signalKind: "dod_fail",
    context: { nodeId },
    severity: "warn",
    timestamp: new Date().toISOString(),
    rawError: failedChecks.join(", "),
  });
}
