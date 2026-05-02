/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { BrowserEventBus } from "../core/browser-harness/event-bus.js";
import { registerDomWatchdog } from "../core/browser-harness/watchdogs/dom.js";

describe("dom watchdog", () => {
  it("emits warn verdict when addedNodes ≥ default threshold (50)", async () => {
    const bus = new BrowserEventBus();
    registerDomWatchdog(bus);
    const verdicts = await bus.dispatch({ kind: "dom.mutation", addedNodes: 100 } as never);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].level).toBe("warn");
    expect((verdicts[0].action as unknown as { type: string }).type).toBe("request_resnapshot");
  });

  it("no verdict when addedNodes < threshold", async () => {
    const bus = new BrowserEventBus();
    registerDomWatchdog(bus);
    const verdicts = await bus.dispatch({ kind: "dom.mutation", addedNodes: 10 } as never);
    expect(verdicts).toHaveLength(0);
  });

  it("custom threshold honoured", async () => {
    const bus = new BrowserEventBus();
    registerDomWatchdog(bus, { largeMutationThreshold: 5 });
    const verdicts = await bus.dispatch({ kind: "dom.mutation", addedNodes: 6 } as never);
    expect(verdicts).toHaveLength(1);
  });
});
