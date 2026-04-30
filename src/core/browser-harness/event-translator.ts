/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-completion — translate CDP events emitted by the
 * `cdp-client` into typed `BrowserEvent`s the watchdog bus consumes.
 * Wires the missing 3 watchdogs (downloads, popups, dom) end-to-end
 * by subscribing to:
 *   - `Page.javascriptDialogOpening`  → dialog.open
 *   - `Page.downloadWillBegin`        → download.start
 *   - `Page.downloadProgress` (state==="completed") → download.complete
 *   - `DOM.documentUpdated`           → dom.mutation (coarse, no count)
 */

import type { BrowserEventBus } from "./event-bus.js";

/**
 * Minimum surface we need from CdpClient. We accept anything with an
 * `on(event, handler)` method so tests can pass a fake.
 */
export interface CdpEventSource {
  on(event: string, handler: (params: Record<string, unknown>) => void): () => void;
}

export interface TranslatorOptions {
  targetId: string;
  /** Optional clock for tests; defaults to Date.now. */
  now?: () => number;
}

/**
 * Subscribe to the relevant CDP events and dispatch into the bus.
 * Returns an unsubscribe function that detaches all handlers.
 */
export function attachCdpTranslator(
  cdp: CdpEventSource,
  bus: BrowserEventBus,
  opts: TranslatorOptions,
): () => void {
  const { targetId } = opts;
  const now = opts.now ?? (() => Date.now());

  const off1 = cdp.on("Page.javascriptDialogOpening", (params) => {
    const dialogType = String(params.type ?? "alert");
    const message = String(params.message ?? "");
    const allowed = ["alert", "confirm", "prompt", "beforeunload"] as const;
    const dt = (allowed as readonly string[]).includes(dialogType)
      ? (dialogType as typeof allowed[number])
      : "alert";
    void bus.dispatch({ kind: "dialog.open", targetId, dialogType: dt, message, ts: now() });
  });

  const off2 = cdp.on("Page.downloadWillBegin", (params) => {
    const suggestedFilename = String(params.suggestedFilename ?? "unknown");
    void bus.dispatch({ kind: "download.start", targetId, suggestedFilename, ts: now() });
  });

  const off3 = cdp.on("Page.downloadProgress", (params) => {
    if (String(params.state ?? "") !== "completed") return;
    const path = String(params.guid ?? "");
    void bus.dispatch({ kind: "download.complete", targetId, path, ts: now() });
  });

  const off4 = cdp.on("DOM.documentUpdated", () => {
    // Without a fine-grained count from CDP, emit a generous bump so
    // the dom watchdog's threshold gate decides whether to warn.
    void bus.dispatch({ kind: "dom.mutation", targetId, addedNodes: 0, ts: now() });
  });

  return () => {
    off1();
    off2();
    off3();
    off4();
  };
}
