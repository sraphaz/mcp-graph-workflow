/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-8.T01 — Caveman mode output filter.
 * When set_phase({caveman:true}) is active, post-processes LLM responses
 * to strip articles, hedging, and filler so output token cost drops ≥ 60%.
 *
 * Pure: input string → compact string. Caller (LLM gateway) wraps responses
 * when project_settings.caveman === true.
 */

export const CAVEMAN_REDUCTION_TARGET = 0.4; // output ≤ 40% of original

const ARTICLES = /\b(?:the|a|an)\b/gi;

const FILLER_PHRASES: RegExp[] = [
  /\b(?:actually|basically|essentially|literally|honestly|obviously|simply|just|really|very|quite|rather)\b/gi,
  /\b(?:in order to)\b/gi,
  /\b(?:as a matter of fact)\b/gi,
  /\b(?:to be honest)\b/gi,
  /\b(?:at the end of the day)\b/gi,
];

const HEDGES: RegExp[] = [
  /\b(?:i think(?: that)?|i believe(?: that)?|i'd say(?: that)?|i would say(?: that)?|in my opinion|it seems(?: that)?|it appears(?: that)?|maybe|perhaps|probably|possibly|kind of|sort of|somewhat)\b/gi,
];

const TRANSITION_FLUFF: RegExp[] = [
  /\b(?:furthermore|moreover|additionally|consequently|therefore|thus|hence|so)[,:]?\s+/gi,
  /\b(?:however|nonetheless|nevertheless),\s+/gi,
];

/** cavemanFilter — auto-generated description placeholder. */
export function cavemanFilter(text: string): string {
  if (!text) return "";
  let out = text;
  for (const re of HEDGES) out = out.replace(re, "");
  for (const re of FILLER_PHRASES) out = out.replace(re, "");
  for (const re of TRANSITION_FLUFF) out = out.replace(re, "");
  out = out.replace(ARTICLES, "");
  // Collapse repeated whitespace and stranded punctuation.
  out = out
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])\1+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/gm, "")
    .trim();
  return out;
}

/** shouldCavemanFilter — auto-generated description placeholder. */
export function shouldCavemanFilter(
  settings: { caveman?: boolean | null },
): boolean {
  return settings.caveman === true;
}
