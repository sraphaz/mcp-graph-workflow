/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { createLogger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";
import { extractContent, type ExtractionResult } from "./content-extractor.js";

const log = createLogger({ layer: "core", source: "web-capture.ts" });

/** Hostname/IP patterns that must be blocked to prevent SSRF attacks. */
const BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,       // 127.x.x.x loopback
  /^\[?::1\]?$/,                  // IPv6 loopback
  /^0\.0\.0\.0$/,                 // unspecified
  /^10\.\d+\.\d+\.\d+$/,         // 10.0.0.0/8 private
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16.0.0/12 private
  /^192\.168\.\d+\.\d+$/,        // 192.168.0.0/16 private
  /^169\.254\.\d+\.\d+$/,        // link-local
  /^fd[\da-f]{2}:/i,             // ULA IPv6
  /^fc[\da-f]{2}:/i,             // ULA IPv6
];

function toDottedIpv4(hostname: string): string | undefined {
  if (/^\d+$/.test(hostname)) {
    const asNumber = Number(hostname);
    if (!Number.isSafeInteger(asNumber) || asNumber < 0 || asNumber > 0xFFFFFFFF) {
      return undefined;
    }
    const aVar = (asNumber >>> 24) & 0xFF;
    const bVar = (asNumber >>> 16) & 0xFF;
    const cVar = (asNumber >>> 8) & 0xFF;
    const dVar = asNumber & 0xFF;
    return `${aVar}.${bVar}.${cVar}.${dVar}`;
  }

  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    const asNumber = Number.parseInt(hostname, 16);
    if (!Number.isSafeInteger(asNumber) || asNumber < 0 || asNumber > 0xFFFFFFFF) {
      return undefined;
    }
    const aVar = (asNumber >>> 24) & 0xFF;
    const bVar = (asNumber >>> 16) & 0xFF;
    const cVar = (asNumber >>> 8) & 0xFF;
    const dVar = asNumber & 0xFF;
    return `${aVar}.${bVar}.${cVar}.${dVar}`;
  }

  return undefined;
}

/**
 * Returns true when the given URL points to a localhost or private-network
 * address that could be abused as a Server-Side Request Forgery vector.
 */
export function isBlockedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const clean = hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
    const dottedIpv4 = toDottedIpv4(clean);
    if (dottedIpv4 && BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(dottedIpv4))) {
      return true;
    }
    if (clean.toLowerCase().endsWith(".localhost")) {
      return true;
    }
    return BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(clean));
  } catch {
    return true; // unparseable URL → block
  }
}

export interface CaptureOptions {
  /** CSS selector to scope extraction */
  selector?: string;
  /** Navigation timeout in ms (default 30000) */
  timeout?: number;
  /** Wait for this selector before extracting */
  waitForSelector?: string;
  /** Timeout for browser.close() in ms (default 3000) */
  closeTimeoutMs?: number;
}

export interface CaptureResult extends ExtractionResult {
  /** The URL that was captured */
  url: string;
  /** Timestamp of capture */
  capturedAt: string;
}

/**
 * Capture a web page using Playwright headless browser and extract structured content.
 */
export async function captureWebPage(
  url: string,
  options?: CaptureOptions,
): Promise<CaptureResult> {
  if (!url) {
    throw new ValidationError("URL is required", ["url is empty or undefined"]);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError(`Invalid URL: ${url}`, [`"${url}" is not a valid URL`]);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ValidationError(`Only HTTP and HTTPS URLs are supported, got: ${parsed.protocol}`, [`unsupported protocol: ${parsed.protocol}`]);
  }

  if (isBlockedUrl(url)) {
    throw new ValidationError("SSRF protection: URL resolves to a blocked private or loopback address", [`blocked hostname: ${parsed.hostname}`]);
  }
  const timeout = options?.timeout ?? 30_000;

  log.info("Capturing web page", { url, timeout, selector: options?.selector });

  // Dynamic import — Playwright may not be installed
  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    throw new ValidationError(
      "Playwright is not installed. Run 'npx playwright install chromium' to enable web capture.",
      ["playwright dependency missing"],
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { timeout, waitUntil: "domcontentloaded" });

    if (options?.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout });
    }

    const html = await page.content();

    const extraction = await extractContent(html, { selector: options?.selector });

    log.info("Web page captured", { url, wordCount: extraction.wordCount });

    return {
      ...extraction,
      url,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await closeBrowserSafely(browser, options?.closeTimeoutMs ?? 3_000);
  }
}

async function closeBrowserSafely(
  browser: { close: () => Promise<void> },
  timeoutMs: number,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await Promise.race([
      browser.close(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error(`browser.close timeout after ${timeoutMs}ms`)),
          { once: true },
        );
      }),
    ]);
  } catch (err) {
    log.warn("Web capture browser close timed out", {
      timeoutMs,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
