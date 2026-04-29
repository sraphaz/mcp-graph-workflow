/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §HOOKS-PRD Objective #1 — every channel declared in HOOK_CHANNELS must
 * have ≥1 emission point in production source code (excludes /tests).
 *
 * This test prevents the failure mode where a channel is added to the enum
 * but never emitted — making it a public API promise the system never keeps.
 *
 * Pending exceptions (must be removed when the corresponding EPIC ships):
 *   - swarm:consensus-reached → EPIC 19 (Multi-Agent Topologies)
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { HOOK_CHANNELS } from "../core/hooks/hook-types.js";

/** Channels temporarily allowed to have zero emission points. */
const PENDING_EMISSION = new Set<string>([
  "swarm:consensus-reached", // EPIC 19 — Multi-Agent Topologies
  "agent:p2p-receive",       // EPIC 20.T02-T03 — wired when swarm-coordinator hooks recv() into the bus
  "agent:p2p-ack",           // EPIC 20.T02-T03 — wired when swarm-coordinator hooks ack() into the bus
]);

function countEmissionsInProductionCode(channel: string): number {
  // Match: channel: "name" or channel: 'name' — same shape used by HookBus.emit()
  // Excludes src/tests/** and dist/** to avoid counting test fixtures.
  try {
    const cmd = `grep -rln --include='*.ts' --exclude-dir=tests --exclude-dir=dist 'channel: "${channel}"' src/ 2>/dev/null || true`;
    const out = execSync(cmd, { encoding: "utf8" }).trim();
    if (!out) return 0;
    return out.split("\n").filter((l) => l.length > 0).length;
  } catch {
    return 0;
  }
}

describe("Hook channel emission coverage (HOOKS-PRD Obj #1)", () => {
  for (const channel of HOOK_CHANNELS) {
    const isPending = PENDING_EMISSION.has(channel);
    const testFn = isPending ? it.skip : it;
    testFn(`channel "${channel}" is emitted in production code`, () => {
      const emissionFiles = countEmissionsInProductionCode(channel);
      expect(emissionFiles).toBeGreaterThan(0);
    });
  }

  it("PENDING_EMISSION exceptions remain documented (not silently growing)", () => {
    // Guard: if someone adds a new exception, this assertion forces them to
    // bump the expected count and review the rationale.
    expect(PENDING_EMISSION.size).toBeLessThanOrEqual(3);
    expect(PENDING_EMISSION.has("swarm:consensus-reached")).toBe(true);
    expect(PENDING_EMISSION.has("agent:p2p-receive")).toBe(true);
    expect(PENDING_EMISSION.has("agent:p2p-ack")).toBe(true);
  });
});
