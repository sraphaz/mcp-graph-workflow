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
 * Runtime safety helpers for dashboard rendering paths where API payloads can be partial.
 */

export function safePercentage(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value as number);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

/** safeEntries — auto-generated description placeholder. */
export function safeEntries<T>(value: Record<string, T> | null | undefined): [string, T][] {
  return value ? Object.entries(value) : [];
}
