/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-browser-resilience — 6 tests covering 5 watchdogs +
 * integration through BrowserEventBus.
 */

import { describe, it, expect } from "vitest";
import { BrowserEventBus, type BrowserEvent, type WatchdogVerdict } from "../core/browser-harness/event-bus.js";
import {
  registerDefaultWatchdogs,
  registerDownloadsWatchdog,
  registerPopupsWatchdog,
  registerSecurityWatchdog,
  registerDomWatchdog,
  registerBlankPageWatchdog,
} from "../core/browser-harness/watchdogs/index.js";

const ts = (n = 0) => 1_000_000 + n;

describe("downloads watchdog", () => {
  it("warns on suspicious suffixes", async () => {
    const bus = new BrowserEventBus();
    registerDownloadsWatchdog(bus);
    const v = await bus.dispatch({ kind: "download.start", targetId: "t1", suggestedFilename: "payload.exe", ts: ts() });
    expect(v).toHaveLength(1);
    expect(v[0]!.level).toBe("warn");
    expect(v[0]!.action?.type).toBe("log_audit");
  });

  it("info on normal downloads", async () => {
    const bus = new BrowserEventBus();
    registerDownloadsWatchdog(bus);
    const v = await bus.dispatch({ kind: "download.start", targetId: "t1", suggestedFilename: "report.pdf", ts: ts() });
    expect(v[0]!.level).toBe("info");
  });
});

describe("popups watchdog", () => {
  it("accepts alert/confirm, cancels prompt", async () => {
    const bus = new BrowserEventBus();
    registerPopupsWatchdog(bus);
    const alert = (await bus.dispatch({ kind: "dialog.open", targetId: "t1", dialogType: "alert", message: "x", ts: ts() }))[0];
    const prompt = (await bus.dispatch({ kind: "dialog.open", targetId: "t1", dialogType: "prompt", message: "y", ts: ts() }))[0];
    expect(alert!.action?.accept).toBe(true);
    expect(prompt!.action?.accept).toBe(false);
  });
});

describe("security watchdog", () => {
  it("blocks navigation outside allow-list", async () => {
    const bus = new BrowserEventBus();
    registerSecurityWatchdog(bus, { allowedOrigins: ["example.com"] });
    const v = await bus.dispatch({
      kind: "navigation.cross_origin",
      targetId: "t1",
      fromOrigin: "https://example.com",
      toOrigin: "https://evil.test",
      ts: ts(),
    });
    expect(v[0]!.level).toBe("block");
    expect(v[0]!.action?.type).toBe("abort_navigation");
  });

  it("allows when target matches allow-list", async () => {
    const bus = new BrowserEventBus();
    registerSecurityWatchdog(bus, { allowedOrigins: ["example.com"] });
    const v = await bus.dispatch({
      kind: "navigation.cross_origin",
      targetId: "t1",
      fromOrigin: "https://example.com",
      toOrigin: "https://api.example.com/v1",
      ts: ts(),
    });
    expect(v[0]!.level).toBe("info");
  });
});

describe("dom watchdog", () => {
  it("warns on large mutations, ignores small ones", async () => {
    const bus = new BrowserEventBus();
    registerDomWatchdog(bus, { largeMutationThreshold: 25 });
    const big = await bus.dispatch({ kind: "dom.mutation", targetId: "t1", addedNodes: 100, ts: ts() });
    const small = await bus.dispatch({ kind: "dom.mutation", targetId: "t1", addedNodes: 5, ts: ts() });
    expect(big[0]!.level).toBe("warn");
    expect(small).toHaveLength(0);
  });
});

describe("blank-page watchdog", () => {
  it("flags about:blank load + page.blank events", async () => {
    const bus = new BrowserEventBus();
    registerBlankPageWatchdog(bus);
    const explicit = await bus.dispatch({ kind: "page.blank", targetId: "t1", ts: ts() });
    const loaded = await bus.dispatch({ kind: "page.load", targetId: "t1", url: "about:blank", ts: ts() });
    const ok = await bus.dispatch({ kind: "page.load", targetId: "t1", url: "https://x.test", ts: ts() });
    expect(explicit[0]!.level).toBe("warn");
    expect(loaded[0]!.level).toBe("warn");
    expect(ok).toHaveLength(0);
  });
});

describe("integration — registerDefaultWatchdogs", () => {
  it("registers all 5 watchdogs and dispatches in parallel", async () => {
    const bus = new BrowserEventBus();
    registerDefaultWatchdogs(bus, { security: { allowedOrigins: ["allowed.test"] } });

    expect(bus.watchdogCount("download.start")).toBe(1);
    expect(bus.watchdogCount("dialog.open")).toBe(1);
    expect(bus.watchdogCount("navigation.cross_origin")).toBe(1);
    expect(bus.watchdogCount("dom.mutation")).toBe(1);
    expect(bus.watchdogCount("page.blank")).toBe(1);
    expect(bus.watchdogCount("page.load")).toBe(1);

    // Dispatch a flurry of events, verify each is handled by its watchdog.
    const events: BrowserEvent[] = [
      { kind: "download.start", targetId: "t", suggestedFilename: "x.exe", ts: ts() },
      { kind: "dialog.open", targetId: "t", dialogType: "alert", message: "hi", ts: ts() },
      { kind: "navigation.cross_origin", targetId: "t", fromOrigin: "https://allowed.test", toOrigin: "https://blocked.test", ts: ts() },
      { kind: "dom.mutation", targetId: "t", addedNodes: 999, ts: ts() },
      { kind: "page.blank", targetId: "t", ts: ts() },
    ];
    const verdicts: WatchdogVerdict[] = [];
    for (const e of events) verdicts.push(...(await bus.dispatch(e)));

    expect(verdicts).toHaveLength(5);
    expect(verdicts.map((v) => v.watchdog)).toEqual([
      "downloads", "popups", "security", "dom", "blank-page",
    ]);
    // The security watchdog blocked the cross-origin nav.
    expect(verdicts.find((v) => v.watchdog === "security")!.level).toBe("block");
  });

  it("a crashing watchdog does not break dispatch", async () => {
    const bus = new BrowserEventBus();
    bus.on("dom.mutation", "buggy", () => {
      throw new Error("boom");
    });
    registerDomWatchdog(bus);
    const v = await bus.dispatch({ kind: "dom.mutation", targetId: "t", addedNodes: 999, ts: ts() });
    // Verdicts: the buggy one becomes a warn, the real dom watchdog still ran.
    expect(v.find((x) => x.watchdog === "buggy")!.level).toBe("warn");
    expect(v.find((x) => x.watchdog === "dom")!.level).toBe("warn");
  });
});
