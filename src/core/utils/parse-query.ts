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
 * Safe query-param parsing utilities.
 *
 * Prevents NaN injection when `parseInt` / `Number` is called on untrusted
 * query-string values that may be undefined or non-numeric.
 */

export interface ParseIntResult {
  value: number;
  error?: string;
}

/**
 * Safely parse an integer from an Express query parameter.
 *
 * @param raw    - The raw query param (may be string | undefined).
 * @param opts   - min/max bounds and the default value when raw is absent.
 * @returns      Parsed value, or an error string if invalid.
 */
export function safeParseInt(
  raw: string | undefined,
  opts: { min?: number; max?: number; defaultValue: number },
): ParseIntResult {
  if (raw === undefined || raw === "") {
    return { value: opts.defaultValue };
  }

  const n = parseInt(raw, 10);

  if (isNaN(n)) {
    return { value: opts.defaultValue, error: `Expected integer, got: "${raw}"` };
  }
  if (opts.min !== undefined && n < opts.min) {
    return { value: opts.defaultValue, error: `Value ${n} is below minimum ${opts.min}` };
  }
  if (opts.max !== undefined && n > opts.max) {
    return { value: opts.defaultValue, error: `Value ${n} exceeds maximum ${opts.max}` };
  }

  return { value: n };
}
