/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-completion — CDP→BrowserEvent translator tests. Closes
 * the last integration gap by wiring the 3 watchdogs (downloads,
 * popups, dom) that PR #292 left dispatching-less.
 */

import { describe, it, expect } from "vitest";
import { attachCdpTranslator } from "../core/browser-harness/event-translator.js";
import { BrowserEventBus, type BrowserEvent } from "../core/browser-harness/event-bus.js";

class FakeCdp {
  private handlers = new Map<string, Set<(p: Record<string, unknown>) => void>>();
  on(event: string, handler: (p: Record<string, unknown>) => void): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler);
    this.handlers.set(event, set);
    return () => set.delete(handler);
  }
  fire(event: string, params: Record<string, unknown>): void {
    for (const h of this.handlers.get(event) ?? new Set()) h(params);
  }
  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

describe("attachCdpTranslator", () => {
  it("translates Page.javascriptDialogOpening into dialog.open", async () => {
    const bus = new BrowserEventBus();
    const seen: BrowserEvent[] = [];
    bus.on("dialog.open", "spy", (e) => { seen.push(e); return undefined; });
    const cdp = new FakeCdp();
    attachCdpTranslator(cdp, bus, { targetId: "t1" });
    cdp.fire("Page.javascriptDialogOpening", { type: "confirm", message: "ok?" });
    await new Promise((r) => setImmediate(r));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe("dialog.open");
    expect((seen[0] as { dialogType: string }).dialogType).toBe("confirm");
  });

  it("translates Page.downloadWillBegin into download.start", async () => {
    const bus = new BrowserEventBus();
    const seen: BrowserEvent[] = [];
    bus.on("download.start", "spy", (e) => { seen.push(e); return undefined; });
    const cdp = new FakeCdp();
    attachCdpTranslator(cdp, bus, { targetId: "t1" });
    cdp.fire("Page.downloadWillBegin", { suggestedFilename: "report.pdf" });
    await new Promise((r) => setImmediate(r));
    expect(seen).toHaveLength(1);
    expect((seen[0] as { suggestedFilename: string }).suggestedFilename).toBe("report.pdf");
  });

  it("translates Page.downloadProgress (completed) into download.complete; ignores other states", async () => {
    const bus = new BrowserEventBus();
    const seen: BrowserEvent[] = [];
    bus.on("download.complete", "spy", (e) => { seen.push(e); return undefined; });
    const cdp = new FakeCdp();
    attachCdpTranslator(cdp, bus, { targetId: "t1" });
    cdp.fire("Page.downloadProgress", { state: "inProgress", guid: "g1" });
    cdp.fire("Page.downloadProgress", { state: "completed", guid: "g1" });
    await new Promise((r) => setImmediate(r));
    expect(seen).toHaveLength(1);
  });

  it("translates DOM.documentUpdated into dom.mutation", async () => {
    const bus = new BrowserEventBus();
    const seen: BrowserEvent[] = [];
    bus.on("dom.mutation", "spy", (e) => { seen.push(e); return undefined; });
    const cdp = new FakeCdp();
    attachCdpTranslator(cdp, bus, { targetId: "t1" });
    cdp.fire("DOM.documentUpdated", {});
    await new Promise((r) => setImmediate(r));
    expect(seen).toHaveLength(1);
    expect((seen[0] as { addedNodes: number }).addedNodes).toBe(0);
  });

  it("returns an unsubscribe function that detaches all 4 listeners", () => {
    const bus = new BrowserEventBus();
    const cdp = new FakeCdp();
    const detach = attachCdpTranslator(cdp, bus, { targetId: "t1" });
    expect(cdp.listenerCount("Page.javascriptDialogOpening")).toBe(1);
    expect(cdp.listenerCount("Page.downloadWillBegin")).toBe(1);
    expect(cdp.listenerCount("Page.downloadProgress")).toBe(1);
    expect(cdp.listenerCount("DOM.documentUpdated")).toBe(1);
    detach();
    expect(cdp.listenerCount("Page.javascriptDialogOpening")).toBe(0);
    expect(cdp.listenerCount("Page.downloadWillBegin")).toBe(0);
    expect(cdp.listenerCount("Page.downloadProgress")).toBe(0);
    expect(cdp.listenerCount("DOM.documentUpdated")).toBe(0);
  });
});
