/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T05 — Memory PII scanner.
 * Detects + redacts personally identifiable information (PII) and credentials
 * before persisting to the memory store. Pure-function detector; the hook
 * wrapper in builtin-handlers.ts decides redact-vs-strict-reject mode.
 */

export type PiiKind = "email" | "ssn" | "credit_card" | "api_token";

export interface PiiHit {
  kind: PiiKind;
  start: number;
  end: number;
  match: string;
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CC_RE = /\b\d{13,19}\b/g;
// Token patterns: sk-* (OpenAI/Anthropic), xoxb-* (Slack), ghp_* (GitHub),
// xoxa-/xoxp-/xoxs- variants. Min length 20 chars after prefix to avoid noise.
const TOKEN_RES: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g,
  /\bghp_[A-Za-z0-9]{36,}\b/g,
  /\bgho_[A-Za-z0-9]{36,}\b/g,
  /\bghu_[A-Za-z0-9]{36,}\b/g,
];

/** Luhn checksum validation for credit-card-like digit sequences. */
function isValidLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const ch = digits[i];
    if (ch === undefined) return false;
    let n = Number.parseInt(ch, 10);
    if (Number.isNaN(n)) return false;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function findAll(content: string, re: RegExp, kind: PiiKind, validator?: (m: string) => boolean): PiiHit[] {
  const hits: PiiHit[] = [];
  // Reset regex lastIndex (global flag persists state across calls).
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (validator && !validator(m[0])) continue;
    hits.push({ kind, start: m.index, end: m.index + m[0].length, match: m[0] });
  }
  return hits;
}

export function scanForPii(content: string): PiiHit[] {
  if (!content || content.length === 0) return [];
  const hits: PiiHit[] = [];
  hits.push(...findAll(content, EMAIL_RE, "email"));
  hits.push(...findAll(content, SSN_RE, "ssn"));
  hits.push(...findAll(content, CC_RE, "credit_card", isValidLuhn));
  for (const re of TOKEN_RES) {
    hits.push(...findAll(content, re, "api_token"));
  }
  // Sort by start so redaction can walk left-to-right.
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

export function hasPii(content: string): boolean {
  return scanForPii(content).length > 0;
}

const REDACTION_LABEL: Record<PiiKind, string> = {
  email: "[REDACTED-EMAIL]",
  ssn: "[REDACTED-SSN]",
  credit_card: "[REDACTED-CC]",
  api_token: "[REDACTED-TOKEN]",
};

export function redactPii(content: string): string {
  const hits = scanForPii(content);
  if (hits.length === 0) return content;

  // Walk right-to-left so earlier offsets remain valid as we splice.
  const sorted = [...hits].sort((a, b) => b.start - a.start);
  let out = content;
  for (const h of sorted) {
    out = out.slice(0, h.start) + REDACTION_LABEL[h.kind] + out.slice(h.end);
  }
  return out;
}
