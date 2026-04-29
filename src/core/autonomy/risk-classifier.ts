/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D1 — Risk classifier for AC.
 * Heuristic mapping {trivial, low, medium, high} a partir do node metadata.
 * D2 auto-approval policy aprova trivial+low com confidence > 0.95 sem
 * checkpoint humano. Fail-safe: sinais conflitantes ⇒ high.
 */

export type RiskLevel = "trivial" | "low" | "medium" | "high";

export interface RiskNode {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  testFiles?: string[];
  xpSize?: "XS" | "S" | "M" | "L" | "XL";
  filesChanged?: string[];
  linesChanged?: number;
}

export interface RiskClassification {
  risk: RiskLevel;
  confidence: number;
  signals: string[];
}

const HIGH_RISK_KEYWORDS = [
  /security/i, /auth(entication|orization)?/i, /\bjwt\b/i, /\boauth\b/i,
  /migration/i, /\bmigrate\b/i, /\bschema\b/i, /database\s+constraint/i,
  /\bcrypto/i, /\bsecret/i, /\bcredential/i, /\bpii\b/i, /\bgdpr\b/i,
  /\bbilling\b/i, /\bpayment\b/i, /\bstripe\b/i,
];

const TRIVIAL_KEYWORDS = [
  /\btypo\b/i, /\bwhitespace\b/i, /\brename\b/i, /\bcomment\b/i,
  /\bdocstring\b/i, /\breadme\b/i, /\bformat(ting)?\b/i, /\blint\b/i,
];

const LOW_RISK_KEYWORDS = [
  /\brefactor\b/i, /\bextract\b/i, /\binline\b/i, /\bclean.?up\b/i,
];

const MEDIUM_RISK_KEYWORDS = [
  /\bfeature\b/i, /\badd\b/i, /\bimplement\b/i, /\bnew\b/i, /\bintegration\b/i,
];

function corpus(node: RiskNode): string {
  return [
    node.title ?? "",
    node.description ?? "",
    ...(node.acceptanceCriteria ?? []),
  ].join(" ");
}

function matchedPatterns(text: string, patterns: RegExp[]): string[] {
  const hits: string[] = [];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) hits.push(m[0].toLowerCase());
  }
  return hits;
}

export function classifyRisk(node: RiskNode): RiskClassification {
  const text = corpus(node);
  const signals: string[] = [];

  const highHits = matchedPatterns(text, HIGH_RISK_KEYWORDS);
  const trivialHits = matchedPatterns(text, TRIVIAL_KEYWORDS);
  const lowHits = matchedPatterns(text, LOW_RISK_KEYWORDS);
  const mediumHits = matchedPatterns(text, MEDIUM_RISK_KEYWORDS);

  if (highHits.length > 0) signals.push(`high-keyword:${highHits.join(",")}`);
  if (trivialHits.length > 0) signals.push(`trivial-keyword:${trivialHits.join(",")}`);
  if (lowHits.length > 0) signals.push(`low-keyword:${lowHits.join(",")}`);
  if (mediumHits.length > 0) signals.push(`medium-keyword:${mediumHits.join(",")}`);

  const filesChanged = node.filesChanged?.length ?? 0;
  const linesChanged = node.linesChanged ?? 0;
  if (filesChanged > 5) signals.push(`files-changed:${filesChanged}`);
  if (linesChanged > 200) signals.push(`lines-changed:${linesChanged}`);

  if (node.xpSize === "L" || node.xpSize === "XL") signals.push(`xpSize:${node.xpSize}`);

  // Fail-safe: high keyword OR (trivial AND high together) → high
  if (highHits.length > 0) {
    const conflicting = trivialHits.length > 0 || lowHits.length > 0;
    return {
      risk: "high",
      confidence: conflicting ? 0.6 : 0.9,
      signals,
    };
  }

  // Big diff or big xp → at least medium
  if (filesChanged > 5 || linesChanged > 200 || node.xpSize === "L" || node.xpSize === "XL") {
    return { risk: "medium", confidence: 0.75, signals };
  }

  if (trivialHits.length > 0 && mediumHits.length === 0) {
    return { risk: "trivial", confidence: 0.95, signals };
  }

  if (lowHits.length > 0 && mediumHits.length === 0) {
    return { risk: "low", confidence: 0.85, signals };
  }

  if (mediumHits.length > 0) {
    return { risk: "medium", confidence: 0.7, signals };
  }

  // No signals at all → unknown defaults to high (fail-safe)
  if (signals.length === 0) {
    return { risk: "high", confidence: 0.4, signals: ["no-signals"] };
  }

  return { risk: "medium", confidence: 0.6, signals };
}
