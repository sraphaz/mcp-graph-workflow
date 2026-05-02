/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { BrowserEventBus } from "../core/browser-harness/event-bus.js";
import { registerBlankPageWatchdog } from "../core/browser-harness/watchdogs/blank-page.js";

describe("blank-page watchdog", () => {
  it("page.blank → warn + redirect_or_close", async () => {
    const bus = new BrowserEventBus();
    registerBlankPageWatchdog(bus);
    const verdicts = await bus.dispatch({ kind: "page.blank", targetId: "tab1" } as never);
    expect(verdicts[0].level).toBe("warn");
    expect((verdicts[0].action as unknown as { type: string; targetId: string }).type).toBe(
      "redirect_or_close",
    );
    expect((verdicts[0].action as unknown as { targetId: string }).targetId).toBe("tab1");
  });

  it("page.load with about:blank → warn", async () => {
    const bus = new BrowserEventBus();
    registerBlankPageWatchdog(bus);
    const verdicts = await bus.dispatch({
      kind: "page.load",
      targetId: "tab2",
      url: "about:blank",
    } as never);
    expect(verdicts[0].level).toBe("warn");
  });

  it("page.load with normal URL → no verdict", async () => {
    const bus = new BrowserEventBus();
    registerBlankPageWatchdog(bus);
    const verdicts = await bus.dispatch({
      kind: "page.load",
      targetId: "tab3",
      url: "https://example.com",
    } as never);
    expect(verdicts).toHaveLength(0);
  });
});
