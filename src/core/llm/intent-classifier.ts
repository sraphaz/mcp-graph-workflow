/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T06 — Intent classifier for transform applicability.
 *
 * Pure regex/AST classifier: given a code snippet (and optional task
 * description), returns the most likely transform intent + confidence.
 * Used by the booster (E6.T07) to skip Tier 0 cheap transforms when
 * confidence is too low and fall through to Tier 1 LLM analysis.
 *
 * 6 fixture transform intents:
 *   - typo-fix
 *   - rename-symbol
 *   - extract-function
 *   - inline-variable
 *   - add-test
 *   - format-only
 */

export const INTENT_THRESHOLD = 0.6;

export type TransformIntent =
  | "typo-fix"
  | "rename-symbol"
  | "extract-function"
  | "inline-variable"
  | "add-test"
  | "format-only"
  | "unknown";

interface IntentSignal {
  intent: TransformIntent;
  weight: number;
  pattern: RegExp;
}

const SIGNALS: IntentSignal[] = [
  { intent: "typo-fix", weight: 0.9, pattern: /\btypo\b/i },
  { intent: "typo-fix", weight: 0.7, pattern: /\b(spelling|misspell|wording)\b/i },
  { intent: "rename-symbol", weight: 0.9, pattern: /\brename\b/i },
  { intent: "rename-symbol", weight: 0.6, pattern: /\b(symbol|identifier|variable)\b/i },
  { intent: "extract-function", weight: 0.9, pattern: /\bextract\s+(function|method|helper)\b/i },
  { intent: "extract-function", weight: 0.5, pattern: /\bDRY\b/i },
  { intent: "inline-variable", weight: 0.9, pattern: /\binline\s+(variable|const|let)\b/i },
  { intent: "add-test", weight: 0.95, pattern: /\b(add|write|create)\s+(test|spec)\b/i },
  { intent: "add-test", weight: 0.7, pattern: /\bcoverage\b/i },
  { intent: "format-only", weight: 0.95, pattern: /\b(format|prettier|whitespace|reformat)\b/i },
  { intent: "format-only", weight: 0.6, pattern: /\b(indent|tabs|spaces)\b/i },
];

export interface ClassifyInput {
  description?: string;
  code?: string;
}

export interface IntentClassification {
  intent: TransformIntent;
  confidence: number;
  matched: Array<{ intent: TransformIntent; weight: number; pattern: string }>;
  fallthrough: boolean;
}

function combineWeights(weights: number[]): number {
  // Probabilistic OR: 1 - product(1 - w). Caps near 1 without ever crossing.
  if (weights.length === 0) return 0;
  let inverse = 1;
  for (const wVar of weights) inverse *= 1 - Math.max(0, Math.min(1, wVar));
  return 1 - inverse;
}

/** classifyIntent — auto-generated description placeholder. */
export function classifyIntent(input: ClassifyInput): IntentClassification {
  const corpus = `${input.description ?? ""} ${input.code ?? ""}`.trim();
  const matched: IntentClassification["matched"] = [];
  if (!corpus) {
    return { intent: "unknown", confidence: 0, matched, fallthrough: true };
  }

  const byIntent = new Map<TransformIntent, number[]>();
  for (const sig of SIGNALS) {
    if (sig.pattern.test(corpus)) {
      matched.push({ intent: sig.intent, weight: sig.weight, pattern: String(sig.pattern) });
      const arr = byIntent.get(sig.intent) ?? [];
      arr.push(sig.weight);
      byIntent.set(sig.intent, arr);
    }
  }

  if (byIntent.size === 0) {
    return { intent: "unknown", confidence: 0, matched, fallthrough: true };
  }

  let best: TransformIntent = "unknown";
  let bestScore = 0;
  for (const [intent, weights] of byIntent) {
    const score = combineWeights(weights);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }

  return {
    intent: best,
    confidence: bestScore,
    matched,
    fallthrough: bestScore < INTENT_THRESHOLD,
  };
}

/** shouldFallthrough — auto-generated description placeholder. */
export function shouldFallthrough(c: IntentClassification): boolean {
  return c.fallthrough || c.intent === "unknown";
}
