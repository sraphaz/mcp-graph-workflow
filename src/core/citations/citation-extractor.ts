/* eslint-disable security/detect-unsafe-regex */
/*!
 * Lint exemption: the regex patterns in this file are bounded
 * (literal alternations, short character classes, language-keyword
 * lookups) and run against parsed/structured input. The ReDoS class
 * the rule is designed to prevent is not reachable here.
 */
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Citation Extractor — finds references to specs/ADRs/epics embedded in
 * code comments. The accepted form is `§<ID>` where `<ID>` is one or more
 * dot- or hyphen-separated alphanumeric segments (e.g. `§EPIC-7.3`,
 * `§ADR-0049`, `§EPIC-13.1`).
 *
 * Citations anchor implementation back to its design intent and serve as
 * the basis for the `citation_groundedness` analyze mode.
 */

const CITATION_RE = /§[A-Za-z][A-Za-z0-9]*(?:[-.][A-Za-z0-9]+)+/g;
const CITATION_TEST_RE = /§[A-Za-z][A-Za-z0-9]*(?:[-.][A-Za-z0-9]+)+/;

export function extractCitations(text: string): string[] {
  const matches = text.match(CITATION_RE);
  return matches ? [...matches] : [];
}

export function hasCitation(text: string): boolean {
  return CITATION_TEST_RE.test(text);
}
