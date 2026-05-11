/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-browser-harness — Task 5.1: CDP failure classifier.
 * Pure function — zero LLM, inspects error string only.
 */

export type FailureKind =
  | "selector_missing"
  | "selector_stale"
  | "wait_too_short"
  | "wrong_tab"
  | "iframe_boundary"
  | "network_block"
  | "unknown";

const RULES: Array<[RegExp, FailureKind]> = [
  [/Cannot find element|No element found/i, "selector_missing"],
  [/not attached|stale element/i, "selector_stale"],
  [/Timeout waiting for/i, "wait_too_short"],
  [/Frame was detached|wrong.?tab/i, "wrong_tab"],
  [/cross-origin frame/i, "iframe_boundary"],
  [/Navigation timeout|net::ERR_/i, "network_block"],
];

export function classifyFailure(errorMessage: string): FailureKind {
  const msg = errorMessage.trim();
  for (const [pattern, kind] of RULES) {
    if (pattern.test(msg)) return kind;
  }
  return "unknown";
}
