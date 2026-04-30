/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-browser-resilience — downloads watchdog. Browser-use port:
 * tracks download lifecycle so the harness can wait/cleanup files
 * without polling the filesystem.
 */

import type { BrowserEventBus, WatchdogVerdict } from "../event-bus.js";

export interface DownloadsWatchdogOptions {
  /** Filename suffixes considered suspicious (executables, archives). */
  suspiciousSuffixes?: string[];
}

const DEFAULT_SUSPICIOUS = [".exe", ".dmg", ".pkg", ".msi", ".apk", ".bat", ".cmd"];

export function registerDownloadsWatchdog(bus: BrowserEventBus, opts: DownloadsWatchdogOptions = {}): void {
  const suspicious = (opts.suspiciousSuffixes ?? DEFAULT_SUSPICIOUS).map((s) => s.toLowerCase());

  bus.on("download.start", "downloads", (event): WatchdogVerdict => {
    const lower = event.suggestedFilename.toLowerCase();
    if (suspicious.some((suf) => lower.endsWith(suf))) {
      return {
        watchdog: "downloads",
        level: "warn",
        message: `suspicious download suffix: ${event.suggestedFilename}`,
        action: { type: "log_audit", filename: event.suggestedFilename },
      };
    }
    return {
      watchdog: "downloads",
      level: "info",
      message: `download started: ${event.suggestedFilename}`,
    };
  });

  bus.on("download.complete", "downloads", (event): WatchdogVerdict => ({
    watchdog: "downloads",
    level: "info",
    message: `download complete: ${event.path}`,
  }));
}
