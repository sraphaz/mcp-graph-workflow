/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { BrowserEventBus } from "../core/browser-harness/event-bus.js";
import { registerPopupsWatchdog } from "../core/browser-harness/watchdogs/popups.js";

describe("popups watchdog", () => {
  it("alert/confirm/beforeunload → accept=true", async () => {
    const bus = new BrowserEventBus();
    registerPopupsWatchdog(bus);
    for (const dialogType of ["alert", "confirm", "beforeunload"] as const) {
      const verdicts = await bus.dispatch({
        kind: "dialog.open",
        dialogType,
        message: "hello",
      } as never);
      expect(verdicts[0].watchdog).toBe("popups");
      expect(verdicts[0].level).toBe("info");
      expect((verdicts[0].action as unknown as { accept: boolean }).accept).toBe(true);
    }
  });

  it("prompt → accept=false (no input source)", async () => {
    const bus = new BrowserEventBus();
    registerPopupsWatchdog(bus);
    const verdicts = await bus.dispatch({
      kind: "dialog.open",
      dialogType: "prompt",
      message: "enter:",
    } as never);
    expect((verdicts[0].action as unknown as { accept: boolean }).accept).toBe(false);
  });

  it("truncates long messages to ~100 chars in the verdict", async () => {
    const bus = new BrowserEventBus();
    registerPopupsWatchdog(bus);
    const long = "x".repeat(500);
    const verdicts = await bus.dispatch({
      kind: "dialog.open",
      dialogType: "alert",
      message: long,
    } as never);
    expect(verdicts[0].message.length).toBeLessThanOrEqual(120);
  });
});
