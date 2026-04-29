/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication (E20.T04).
 * Tests for the dual-path handoff that auto-falls-back to graph state when
 * A2A is disabled or throws. A2A is COURIER, not authoritative.
 */

import { describe, it, expect } from "vitest";
import {
  createDualPathHandoff,
  type GraphHandoff,
  type A2AHandoffFn,
} from "../core/swarm/a2a-fallback.js";

describe("Dual-path handoff (E20.T04)", () => {
  it("uses A2A path when A2A delivered", async () => {
    const a2a: A2AHandoffFn = async () => ({ delivered: true, messageId: "msg-1" });
    let graphCalled = 0;
    const graph: GraphHandoff = async () => {
      graphCalled++;
      return { recorded: true };
    };
    const handoff = createDualPathHandoff({ a2a, graph });
    const result = await handoff({ from: "a", to: "b", body: 1 });
    expect(result.path).toBe("a2a");
    expect(result.messageId).toBe("msg-1");
    expect(graphCalled).toBe(0);
  });

  it("falls back to graph when A2A not delivered (disabled)", async () => {
    const a2a: A2AHandoffFn = async () => ({ delivered: false, messageId: null });
    let graphCalled = 0;
    const graph: GraphHandoff = async () => {
      graphCalled++;
      return { recorded: true };
    };
    const handoff = createDualPathHandoff({ a2a, graph });
    const result = await handoff({ from: "a", to: "b", body: 1 });
    expect(result.path).toBe("graph");
    expect(result.messageId).toBeNull();
    expect(graphCalled).toBe(1);
  });

  it("falls back to graph when A2A throws", async () => {
    const a2a: A2AHandoffFn = async () => {
      throw new Error("mailbox locked");
    };
    let graphCalled = 0;
    const graph: GraphHandoff = async () => {
      graphCalled++;
      return { recorded: true };
    };
    const handoff = createDualPathHandoff({ a2a, graph });
    const result = await handoff({ from: "a", to: "b", body: 1 });
    expect(result.path).toBe("graph-fallback");
    expect(result.fallbackReason).toContain("mailbox locked");
    expect(graphCalled).toBe(1);
  });

  it("propagates graph error when A2A also failed (no double fallback)", async () => {
    const a2a: A2AHandoffFn = async () => {
      throw new Error("a2a down");
    };
    const graph: GraphHandoff = async () => {
      throw new Error("graph down");
    };
    const handoff = createDualPathHandoff({ a2a, graph });
    await expect(handoff({ from: "a", to: "b", body: 1 })).rejects.toThrow(/graph down/);
  });

  it("path metadata reflects which writer ran (audit trail)", async () => {
    const a2a: A2AHandoffFn = async () => ({ delivered: false, messageId: null });
    const graph: GraphHandoff = async () => ({ recorded: true });
    const handoff = createDualPathHandoff({ a2a, graph });
    const r = await handoff({ from: "x", to: "y", body: "msg" });
    expect(["a2a", "graph", "graph-fallback"]).toContain(r.path);
  });
});
