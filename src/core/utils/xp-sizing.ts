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
 * XP sizing constants — single source of truth.
 *
 * Two distinct mappings by design:
 * - ORDER: sequential ordinal (1-5) for sorting and comparison
 * - POINTS: fibonacci-like story points for velocity and capacity
 *
 * They agree for XS/S/M but diverge for L/XL:
 *   ORDER: L=4, XL=5 (linear ranking)
 *   POINTS: L=5, XL=8 (effort scales non-linearly)
 */

/** Ordinal ranking — sorting/comparison */
export const XP_SIZE_ORDER: Readonly<Record<string, number>> = {
  XS: 1, S: 2, M: 3, L: 4, XL: 5,
};

/** Fibonacci story points — velocity/capacity */
export const XP_SIZE_POINTS: Readonly<Record<string, number>> = {
  XS: 1, S: 2, M: 3, L: 5, XL: 8,
};
