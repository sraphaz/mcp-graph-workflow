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

/**
 * Validate Runner — runs Playwright-based validation for tasks.
 * Captures screenshots and content for comparison (A/B testing support).
 */

import { captureWebPage, type CaptureResult, type CaptureOptions } from "./web-capture.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "validate-runner.ts" });

export interface ValidateOptions extends CaptureOptions {
  /** Second URL for A/B comparison */
  compareUrl?: string;
}

export interface ValidateResult {
  primary: CaptureResult;
  comparison?: CaptureResult;
  diff?: ContentDiff;
  timestamp: string;
}

export interface ContentDiff {
  primaryWordCount: number;
  comparisonWordCount: number;
  wordCountDelta: number;
  primaryLength: number;
  comparisonLength: number;
  lengthDelta: number;
}

/**
 * Run validation by capturing one or two URLs and computing diff.
 */
export async function runValidation(
  url: string,
  options?: ValidateOptions,
): Promise<ValidateResult> {
  log.info("Running validation", { url, compareUrl: options?.compareUrl });

  const primary = await captureWebPage(url, options);

  const resultValue: ValidateResult = {
    primary,
    timestamp: new Date().toISOString(),
  };

  if (options?.compareUrl) {
    const comparison = await captureWebPage(options.compareUrl, options);
    resultValue.comparison = comparison;
    resultValue.diff = computeDiff(primary, comparison);
  }

  log.info("Validation complete", {
    url,
    wordCount: primary.wordCount,
    hasDiff: !!resultValue.diff,
  });

  return resultValue;
}

/**
 * Compute content diff between two captures.
 */
function computeDiff(a: CaptureResult, b: CaptureResult): ContentDiff {
  return {
    primaryWordCount: a.wordCount,
    comparisonWordCount: b.wordCount,
    wordCountDelta: b.wordCount - a.wordCount,
    primaryLength: a.text.length,
    comparisonLength: b.text.length,
    lengthDelta: b.text.length - a.text.length,
  };
}
