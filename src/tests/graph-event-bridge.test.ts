/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §HOOKS-INTEGRATION 5.6 — graph-event-bridge tests.
 */

import { describe, it, expect } from "vitest";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { installGraphEventBridge } from "../core/hooks/graph-event-bridge.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

function captureEvents(): {
  hookBus: HookBus;
  graphBus: GraphEventBus;
  received: HookEvent[];
} {
  const graphBus = new GraphEventBus();
  const hookBus = new HookBus(graphBus);
  const received: HookEvent[] = [];
  hookBus.on("task:pre-execute", async (e) => {
    received.push(e);
  });
  hookBus.on("task:post-complete", async (e) => {
    received.push(e);
  });
  return { hookBus, graphBus, received };
}

describe("graph-event-bridge (HOOKS 5.6)", () => {
  it("re-emits a single mapped graph event onto the configured hook channel", async () => {
    const { graphBus, hookBus, received } = captureEvents();
    installGraphEventBridge(graphBus, hookBus, {
      mapping: { "node:created": ["task:pre-execute"] },
    });

    graphBus.emit({
      type: "node:created",
      timestamp: "2026-04-29T00:00:00Z",
      payload: { id: "n1" },
    });
    await new Promise((r) => setImmediate(r));

    expect(received).toHaveLength(1);
    expect(received[0].channel).toBe("task:pre-execute");
    expect(received[0].payload?._fromBridge).toBe(true);
    expect(received[0].payload?.graphEventType).toBe("node:created");
  });

  it("fans out to multiple hook channels for the same graph event", async () => {
    const { graphBus, hookBus, received } = captureEvents();
    installGraphEventBridge(graphBus, hookBus, {
      mapping: {
        "node:created": ["task:pre-execute", "task:post-complete"],
      },
    });

    graphBus.emit({ type: "node:created", timestamp: "2026-04-29T00:00:00Z", payload: { id: "n1" } });
    await new Promise((r) => setImmediate(r));

    expect(received).toHaveLength(2);
    const channels = received.map((e) => e.channel).sort();
    expect(channels).toEqual(["task:post-complete", "task:pre-execute"]);
  });

  it("entries with empty channel array are disabled (no emission)", async () => {
    const { graphBus, hookBus, received } = captureEvents();
    installGraphEventBridge(graphBus, hookBus, {
      mapping: { "node:created": [] },
    });

    graphBus.emit({ type: "node:created", timestamp: "2026-04-29T00:00:00Z", payload: { id: "n1" } });
    await new Promise((r) => setImmediate(r));

    expect(received).toHaveLength(0);
  });

  it("default behavior is OFF (empty mapping = no bridge subscriptions)", async () => {
    const { graphBus, hookBus, received } = captureEvents();
    installGraphEventBridge(graphBus, hookBus, { mapping: {} });

    graphBus.emit({ type: "node:created", timestamp: "2026-04-29T00:00:00Z", payload: { id: "n1" } });
    await new Promise((r) => setImmediate(r));

    expect(received).toHaveLength(0);
  });

  it("uninstall stops further re-emissions", async () => {
    const { graphBus, hookBus, received } = captureEvents();
    const uninstall = installGraphEventBridge(graphBus, hookBus, {
      mapping: { "node:created": ["task:pre-execute"] },
    });

    graphBus.emit({ type: "node:created", timestamp: "2026-04-29T00:00:00Z", payload: { id: "n1" } });
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1);

    uninstall();
    graphBus.emit({ type: "node:created", timestamp: "2026-04-29T00:00:01Z", payload: { id: "n2" } });
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1); // unchanged
  });
});
