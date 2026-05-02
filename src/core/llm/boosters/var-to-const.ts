/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05a — Booster transform: var → const.
 *
 * Pure regex-based transform. Replaces top-level `var x = ...;` with
 * `const x = ...;` only when:
 *   - the identifier is never reassigned later in the same source
 *   - the declarator has an initializer
 *
 * Skips reassignments to keep semantics intact. Caller (booster-runner)
 * has already passed the safety gate (≥1 test file).
 */

const VAR_DECL_RE = /^(\s*)var(\s+)([a-zA-Z_$][\w$]*)(\s*=\s*[^;]+;)$/gm;
// §EPIC-6.T05a — `id` originates from VAR_DECL_RE capture group 3, which
// matches `[a-zA-Z_$][\w$]*` only — no metacharacters reach the regex source.
const REASSIGN_RE = (id: string): RegExp =>
  // eslint-disable-next-line security/detect-non-literal-regexp
  new RegExp(`(?<!\\.)\\b${id}\\s*(?:=(?!=)|[+\\-*/%]=|\\+\\+|--)`, "g");

export interface VarToConstResult {
  output: string;
  changed: boolean;
  renamed: string[];
  skipped: Array<{ id: string; reason: string }>;
}

/** varToConst — auto-generated description placeholder. */
export function varToConst(source: string): VarToConstResult {
  if (!source.includes("var")) {
    return { output: source, changed: false, renamed: [], skipped: [] };
  }
  const renamed: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  const out = source.replace(
    VAR_DECL_RE,
    (full, indent: string, ws: string, id: string, init: string) => {
      if (renamed.includes(id)) {
        // Already renamed earlier — keep as const (idempotent fix).
        return `${indent}const${ws}${id}${init}`;
      }
      // Check for any reassignment AFTER this declaration position.
      const declStart = source.indexOf(full);
      const declEnd = declStart + full.length;
      const remainder = source.slice(declEnd);
      const re = REASSIGN_RE(id);
      if (re.test(remainder)) {
        skipped.push({ id, reason: "reassigned-later" });
        return full;
      }
      renamed.push(id);
      return `${indent}const${ws}${id}${init}`;
    },
  );

  return {
    output: out,
    changed: out !== source,
    renamed,
    skipped,
  };
}
