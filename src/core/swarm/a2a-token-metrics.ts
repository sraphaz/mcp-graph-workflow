/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication.
 * Token-cost reduction metrics for context handoff. Graph-state handoffs
 * incur a re-read of the full context; A2A handoffs do not. Tracking the
 * difference quantifies the token-economy benefit of opting into A2A.
 */

import type { HandoffPath } from "./a2a-fallback.js";

export interface HandoffSample {
  path: HandoffPath;
  /** Approx. tokens needed to re-load context for this handoff. */
  contextTokens: number;
}

export interface HandoffMetricsSummary {
  totalHandoffs: number;
  graphTokens: number;
  a2aSavedTokens: number;
  tokensSaved: number;
  reductionPercent: number;
  savedCostUsd?: number;
}

export interface SummaryOptions {
  /** USD per 1k tokens to convert savings into dollars. */
  pricePerKToken?: number;
}

export class HandoffMetrics {
  private records: HandoffSample[] = [];

  record(sample: HandoffSample): void {
    this.records.push(sample);
  }

  samples(): readonly HandoffSample[] {
    return [...this.records];
  }

  reset(): void {
    this.records = [];
  }

  summary(opts: SummaryOptions = {}): HandoffMetricsSummary {
    let graphTokens = 0;
    let a2aSavedTokens = 0;
    for (const r of this.records) {
      if (r.path === "a2a") {
        a2aSavedTokens += r.contextTokens;
      } else {
        // graph and graph-fallback both incur re-read cost.
        graphTokens += r.contextTokens;
      }
    }
    const total = a2aSavedTokens + graphTokens;
    const reductionPercent = total > 0 ? (a2aSavedTokens / total) * 100 : 0;
    const summary: HandoffMetricsSummary = {
      totalHandoffs: this.records.length,
      graphTokens,
      a2aSavedTokens,
      tokensSaved: a2aSavedTokens,
      reductionPercent,
    };
    if (opts.pricePerKToken !== undefined) {
      summary.savedCostUsd = (a2aSavedTokens / 1000) * opts.pricePerKToken;
    }
    return summary;
  }
}
