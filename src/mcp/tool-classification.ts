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
 * Tool classification re-exports from constants.ts (single source of truth).
 * This file exists for backward compatibility — import from constants.ts directly.
 *
 * Resolves bugs #007, #013, #015, #022 — inconsistent whitelists between wrappers.
 */

export { ALWAYS_ALLOWED_TOOLS, READ_ONLY_TOOLS, BOOTSTRAP_TOOLS } from "../core/utils/constants.js";
