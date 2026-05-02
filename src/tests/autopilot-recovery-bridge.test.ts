/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { AutopilotRecoveryBridge } from "../core/autonomy/autopilot-recovery-bridge.js";
import type { AutopilotController } from "../core/autonomy/autopilot-controller.js";
import type {
  RecoveryOrchestrator,
  RecoveryMetrics,
} from "../core/autonomy/recovery-orchestrator.js";

interface FakeAutopilot {
  results: Array<{ nodeId: string; success: boolean }>;
}

interface FakeRecovery {
  beginCalls: string[];
  successCalls: string[];
  failureCalls: Array<{ nodeId: string; reason: string }>;
  failResult: {
    rolledBack: boolean;
    canRetry: boolean;
    escalate: boolean;
    attempt: number;
    mttrMs: number;
  };
  metrics: RecoveryMetrics;
}

function makeBridge(failResult?: Partial<FakeRecovery["failResult"]>) {
  const autopilot: FakeAutopilot = { results: [] };
  const recovery: FakeRecovery = {
    beginCalls: [],
    successCalls: [],
    failureCalls: [],
    failResult: {
      rolledBack: false,
      canRetry: true,
      escalate: false,
      attempt: 1,
      mttrMs: 100,
      ...failResult,
    },
    metrics: { mtbfHours: 0, mttrSeconds: 0, recoveryRate: 0, totalRecoveries: 0 } as unknown as RecoveryMetrics,
  };

  const fakeAutopilot = {
    recordResult: (nodeId: string, success: boolean) => {
      autopilot.results.push({ nodeId, success });
    },
  } as unknown as AutopilotController;

  const fakeRecovery = {
    beginTask: (id: string) => recovery.beginCalls.push(id),
    succeedTask: (id: string) => recovery.successCalls.push(id),
    failTask: (id: string, reason: string) => {
      recovery.failureCalls.push({ nodeId: id, reason });
      return recovery.failResult;
    },
    getMetrics: () => recovery.metrics,
  } as unknown as RecoveryOrchestrator;

  return {
    bridge: new AutopilotRecoveryBridge(fakeAutopilot, fakeRecovery),
    autopilot,
    recovery,
  };
}

describe("AutopilotRecoveryBridge", () => {
  it("onTaskStart delegates beginTask to recovery", () => {
    const { bridge, recovery } = makeBridge();
    bridge.onTaskStart("n1");
    expect(recovery.beginCalls).toEqual(["n1"]);
  });

  it("onTaskSuccess marks recovery + autopilot, returns continue", () => {
    const { bridge, autopilot, recovery } = makeBridge();
    const result = bridge.onTaskSuccess("n2");
    expect(result.autopilotAction).toBe("continue");
    expect(recovery.successCalls).toEqual(["n2"]);
    expect(autopilot.results).toEqual([{ nodeId: "n2", success: true }]);
  });

  it("onTaskFailure with escalate=false → autopilotAction=retry", () => {
    const { bridge, autopilot, recovery } = makeBridge({ escalate: false });
    const result = bridge.onTaskFailure("n3", "boom");
    expect(result.autopilotAction).toBe("retry");
    expect(recovery.failureCalls).toEqual([{ nodeId: "n3", reason: "boom" }]);
    expect(autopilot.results).toEqual([{ nodeId: "n3", success: false }]);
  });

  it("onTaskFailure with escalate=true → autopilotAction=pause", () => {
    const { bridge } = makeBridge({ escalate: true });
    const result = bridge.onTaskFailure("n4", "fatal");
    expect(result.autopilotAction).toBe("pause");
    expect(result.escalate).toBe(true);
  });

  it("onTaskFailure flows recovery decision fields through", () => {
    const { bridge } = makeBridge({
      rolledBack: true,
      canRetry: false,
      escalate: true,
      attempt: 3,
      mttrMs: 4321,
    });
    const result = bridge.onTaskFailure("n5", "kaput");
    expect(result.rolledBack).toBe(true);
    expect(result.canRetry).toBe(false);
    expect(result.escalate).toBe(true);
    expect(result.mttrMs).toBe(4321);
  });

  it("getRecoveryMetrics returns the recovery orchestrator's metrics", () => {
    const { bridge, recovery } = makeBridge();
    expect(bridge.getRecoveryMetrics()).toBe(recovery.metrics);
  });
});
