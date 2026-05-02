/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { BrowserEventBus } from "../core/browser-harness/event-bus.js";
import { registerSecurityWatchdog } from "../core/browser-harness/watchdogs/security.js";

describe("security watchdog", () => {
  it("empty allow-list → info verdict on cross-origin", async () => {
    const bus = new BrowserEventBus();
    registerSecurityWatchdog(bus);
    const verdicts = await bus.dispatch({
      kind: "navigation.cross_origin",
      fromOrigin: "https://a.com",
      toOrigin: "https://b.com",
    } as never);
    expect(verdicts[0].level).toBe("info");
  });

  it("allow-list match → info", async () => {
    const bus = new BrowserEventBus();
    registerSecurityWatchdog(bus, { allowedOrigins: ["example.com"] });
    const verdicts = await bus.dispatch({
      kind: "navigation.cross_origin",
      fromOrigin: "https://a.com",
      toOrigin: "https://www.example.com",
    } as never);
    expect(verdicts[0].level).toBe("info");
  });

  it("allow-list miss → block + abort_navigation", async () => {
    const bus = new BrowserEventBus();
    registerSecurityWatchdog(bus, { allowedOrigins: ["allowed.com"] });
    const verdicts = await bus.dispatch({
      kind: "navigation.cross_origin",
      fromOrigin: "https://a.com",
      toOrigin: "https://evil.com",
    } as never);
    expect(verdicts[0].level).toBe("block");
    expect((verdicts[0].action as unknown as { type: string }).type).toBe("abort_navigation");
  });
});
