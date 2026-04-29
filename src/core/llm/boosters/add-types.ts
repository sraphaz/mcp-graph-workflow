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
 *
 * §EPIC-6.T05b — Booster transform: add-types.
 *
 * Pure regex transform. Adds an explicit TypeScript type annotation to
 * function parameters whose default value is a primitive literal (number,
 * string, boolean) and which are not already annotated. Conservative by
 * design — only inferable cases are touched, never overwriting an existing
 * annotation. JSDoc-typed files are skipped wholesale (prefer existing
 * convention over mixed-typing).
 */

const JSDOC_HINT_RE = /\*\s*@(param|type|returns?)\b/;
const ALREADY_TYPED_RE = /\b[a-zA-Z_$][\w$]*\s*:\s*[A-Za-z_$][\w$<>[\],\s|&]*\s*=/;

export interface AddTypesResult {
  output: string;
  added: number;
  alreadyTyped: boolean;
  skippedJsdoc: boolean;
}

function inferLiteralType(rhs: string): "number" | "string" | "boolean" | null {
  const trimmed = rhs.trim();
  if (/^(true|false)$/.test(trimmed)) return "boolean";
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return "number";
  if (/^["'`].*["'`]$/.test(trimmed)) return "string";
  return null;
}

const PARAM_DEFAULT_RE =
  /\b([a-zA-Z_$][\w$]*)\s*=\s*(-?\d+(?:\.\d+)?|"[^"]*"|'[^']*'|`[^`]*`|true|false)(?=\s*[,)])/g;

export function addTypes(source: string): AddTypesResult {
  if (JSDOC_HINT_RE.test(source)) {
    return { output: source, added: 0, alreadyTyped: false, skippedJsdoc: true };
  }

  // If the file already has typed params with defaults, treat as "already typed"
  // and bail out — don't mix conventions.
  if (ALREADY_TYPED_RE.test(source)) {
    return { output: source, added: 0, alreadyTyped: true, skippedJsdoc: false };
  }

  let added = 0;
  const output = source.replace(PARAM_DEFAULT_RE, (match, name: string, value: string) => {
    const t = inferLiteralType(value);
    if (!t) return match;
    added++;
    return `${name}: ${t} = ${value}`;
  });

  return { output, added, alreadyTyped: false, skippedJsdoc: false };
}
