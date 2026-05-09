/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-domain-skills-promotion — Task 1.1: aggregate browser test memory entries by site.
 * Pure function: accepts entries as parameter — no I/O, fully testable.
 */

export interface BrowserTestEntry {
  hostname: string;
  url: string;
  selector: string;
  confirmedAt: string;
  trap: boolean;
}

export interface SkillCandidate {
  pathPattern: string;
  selector: string;
  positive: boolean;
  negative: boolean;
  confirmationCount: number;
  confirmedDates: string[];
}

const NUMERIC_SEGMENT = /^\d+$/;
const UUID_SEGMENT = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const HEX_SEGMENT = /^[\da-f]{16,}$/i;

function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function toPathPattern(pathname: string): string {
  const segments = pathname.split("/");
  return segments
    .map((seg) => {
      if (NUMERIC_SEGMENT.test(seg) || UUID_SEGMENT.test(seg) || HEX_SEGMENT.test(seg)) return "*";
      return seg;
    })
    .join("/");
}

function isoDateOnly(isoString: string): string {
  return isoString.slice(0, 10);
}

export function aggregateBySite(hostname: string, entries: BrowserTestEntry[]): SkillCandidate[] {
  const filtered = entries.filter((e) => e.hostname === hostname);
  if (filtered.length === 0) return [];

  type Key = string;
  const groups = new Map<Key, { dates: Set<string>; count: number; hasNegative: boolean }>();

  for (const entry of filtered) {
    const path = extractPath(entry.url);
    const pattern = toPathPattern(path);
    const key: Key = `${pattern}\x00${entry.selector}`;

    const existing = groups.get(key);
    if (existing) {
      existing.dates.add(isoDateOnly(entry.confirmedAt));
      existing.count += 1;
      if (entry.trap) existing.hasNegative = true;
    } else {
      groups.set(key, {
        dates: new Set([isoDateOnly(entry.confirmedAt)]),
        count: 1,
        hasNegative: entry.trap,
      });
    }
  }

  const results: SkillCandidate[] = [];
  for (const [key, agg] of groups) {
    const [pathPattern, selector] = key.split("\x00") as [string, string];
    results.push({
      pathPattern,
      selector,
      positive: agg.dates.size >= 2 && !agg.hasNegative,
      negative: agg.hasNegative,
      confirmationCount: agg.count,
      confirmedDates: [...agg.dates].sort(),
    });
  }

  return results;
}
