/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-browser-harness — Task 5.2: Recovery primitives — selector candidates + wait increment.
 * Pure module — no LLM, no side effects. Reasoning ported from
 * vendor/browser-use-main/browser_use/agent/variable_detector.py (attribute-priority strategy).
 */

import type { FailureKind } from "./failure-classifier.js";

export interface DomElement {
  tag?: string;
  role?: string;
  ariaLabel?: string;
  name?: string;
  placeholder?: string;
  dataAttrs?: Record<string, string>;
  text?: string;
}

export interface DomSnapshot {
  elements: DomElement[];
  capturedAt?: number;
}

export interface RecoveryProposal {
  selectorCandidates: string[];
  suggestedWaitMs?: number;
}

const MAX_CANDIDATES = 5;

/**
 * Build up to MAX_CANDIDATES CSS selector strings from a prior DOM snapshot.
 * Every selector value is drawn exclusively from observed element attributes —
 * never guesses or infers attribute values not present in the snapshot.
 */
export function proposeSelectorCandidates(snapshot: DomSnapshot | null): string[] {
  if (!snapshot || snapshot.elements.length === 0) return [];

  const candidates: string[] = [];

  for (const el of snapshot.elements) {
    if (candidates.length >= MAX_CANDIDATES) break;
    const parts = buildSelectorsFromElement(el);
    for (const s of parts) {
      if (candidates.length >= MAX_CANDIDATES) break;
      if (!candidates.includes(s)) candidates.push(s);
    }
  }

  return candidates;
}

function buildSelectorsFromElement(el: DomElement): string[] {
  const result: string[] = [];
  const tag = el.tag ?? "";

  // Priority order mirrors vendor variable_detector: aria-label, name, placeholder, role, data-*
  if (el.ariaLabel) result.push(`${tag}[aria-label="${el.ariaLabel}"]`);
  if (el.name) result.push(`${tag}[name="${el.name}"]`);
  if (el.placeholder) result.push(`${tag}[placeholder="${el.placeholder}"]`);
  if (el.role) result.push(`[role="${el.role}"]`);

  if (el.dataAttrs) {
    for (const [k, v] of Object.entries(el.dataAttrs)) {
      result.push(`[data-${k}="${v}"]`);
    }
  }

  return result;
}

/**
 * Propose a new wait value based on the median of prior successful wait times for a domain.
 * Falls back to 2× current when no history exists.
 */
export function proposeWaitIncrement(domainHistory: number[], currentWaitMs: number): number {
  if (domainHistory.length === 0) return currentWaitMs * 2;

  const sorted = [...domainHistory].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? currentWaitMs);

  return Math.max(currentWaitMs + 1000, Math.round(median * 1.5));
}

/**
 * Unified recovery proposal — dispatches by failure kind.
 * Returns structured suggestions without invoking any LLM.
 */
export function proposeRecovery(
  kind: FailureKind,
  snapshot: DomSnapshot | null,
  domainWaitHistory: number[],
  currentWaitMs: number,
): RecoveryProposal {
  if (kind === "selector_missing") {
    return { selectorCandidates: proposeSelectorCandidates(snapshot) };
  }

  if (kind === "wait_too_short") {
    return {
      selectorCandidates: [],
      suggestedWaitMs: proposeWaitIncrement(domainWaitHistory, currentWaitMs),
    };
  }

  return { selectorCandidates: [] };
}
