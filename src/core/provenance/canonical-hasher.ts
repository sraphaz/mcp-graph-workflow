/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Canonical Node Hasher — the cheapest leg of the three-layer provenance tier.
 *
 * Produces a deterministic SHA-256 digest of any JSON-serializable value by:
 *   1. recursively sorting object keys,
 *   2. trimming leading/trailing whitespace in string values,
 *   3. emitting whitespace-free JSON with no indentation.
 *
 * Two nodes that differ only in key order or surrounding whitespace hash to
 * the same digest; any semantic change (added/removed key, flipped char,
 * array reordering) produces a different digest.
 */

import { createHash } from "node:crypto";

/** canonicalSerialize — auto-generated description placeholder. */
export function canonicalSerialize(value: unknown): string {
  return serialize(value);
}

/** hashNodeCanonical — auto-generated description placeholder. */
export function hashNodeCanonical(value: unknown): string {
  const canonical = serialize(value);
  return createHash("sha256").update(canonical).digest("hex");
}

function serialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value.trim());
  if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const body = entries.map(([k, v]) => `${JSON.stringify(k)}:${serialize(v)}`).join(",");
    return `{${body}}`;
  }
  // undefined, functions, symbols — collapsed to null for determinism
  return "null";
}
