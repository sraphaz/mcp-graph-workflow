/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { BrowserEventBus } from "../core/browser-harness/event-bus.js";
import { registerDownloadsWatchdog } from "../core/browser-harness/watchdogs/downloads.js";

describe("downloads watchdog", () => {
  it("default suspicious suffix → warn", async () => {
    const bus = new BrowserEventBus();
    registerDownloadsWatchdog(bus);
    const verdicts = await bus.dispatch({
      kind: "download.start",
      suggestedFilename: "malware.exe",
    } as never);
    expect(verdicts[0].level).toBe("warn");
    expect(
      (verdicts[0].action as unknown as { type: string; filename: string }).filename,
    ).toBe("malware.exe");
  });

  it("safe suffix → info", async () => {
    const bus = new BrowserEventBus();
    registerDownloadsWatchdog(bus);
    const verdicts = await bus.dispatch({
      kind: "download.start",
      suggestedFilename: "report.pdf",
    } as never);
    expect(verdicts[0].level).toBe("info");
  });

  it("custom suspicious list overrides default", async () => {
    const bus = new BrowserEventBus();
    registerDownloadsWatchdog(bus, { suspiciousSuffixes: [".pdf"] });
    const verdicts = await bus.dispatch({
      kind: "download.start",
      suggestedFilename: "report.pdf",
    } as never);
    expect(verdicts[0].level).toBe("warn");
  });

  it("download.complete emits info verdict", async () => {
    const bus = new BrowserEventBus();
    registerDownloadsWatchdog(bus);
    const verdicts = await bus.dispatch({
      kind: "download.complete",
      path: "/tmp/file.pdf",
    } as never);
    expect(verdicts[0].level).toBe("info");
  });
});
