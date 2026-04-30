/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-browser-resilience — registers all 5 default watchdogs.
 */

import type { BrowserEventBus } from "../event-bus.js";
import { registerDownloadsWatchdog, type DownloadsWatchdogOptions } from "./downloads.js";
import { registerPopupsWatchdog } from "./popups.js";
import { registerSecurityWatchdog, type SecurityWatchdogOptions } from "./security.js";
import { registerDomWatchdog, type DomWatchdogOptions } from "./dom.js";
import { registerBlankPageWatchdog } from "./blank-page.js";

export interface DefaultWatchdogOptions {
  downloads?: DownloadsWatchdogOptions;
  security?: SecurityWatchdogOptions;
  dom?: DomWatchdogOptions;
}

/**
 * Register the 5 default watchdogs (downloads, popups, security, dom,
 * blank-page) on a fresh bus. Returns nothing — handlers are managed
 * via the bus's own `on()` return value if individual unregister is
 * needed in tests.
 */
export function registerDefaultWatchdogs(bus: BrowserEventBus, opts: DefaultWatchdogOptions = {}): void {
  registerDownloadsWatchdog(bus, opts.downloads);
  registerPopupsWatchdog(bus);
  registerSecurityWatchdog(bus, opts.security);
  registerDomWatchdog(bus, opts.dom);
  registerBlankPageWatchdog(bus);
}

export { registerDownloadsWatchdog, registerPopupsWatchdog, registerSecurityWatchdog, registerDomWatchdog, registerBlankPageWatchdog };
