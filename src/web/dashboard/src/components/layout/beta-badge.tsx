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
 * Beta Badge — red bolt badge to signal features in Beta.
 */
export function BetaBadge(): React.JSX.Element {
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5
                 text-[10px] font-bold uppercase tracking-wider
                 bg-red-500/15 text-red-500 rounded-full border border-red-500/30"
    >
      ⚡ Beta
    </span>
  );
}
