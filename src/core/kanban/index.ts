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

export { buildKanbanBoard } from './kanban-builder.js';
export { generateSuggestions } from './kanban-orchestrator.js';
export { DEFAULT_WIP_LIMITS, DEFAULT_KANBAN_CONFIG, COLUMN_ORDER, COLUMN_TITLES } from './kanban-types.js';
export type { KanbanCard, KanbanColumn, WipViolation, KanbanMetrics, KanbanSwimlane, KanbanBoard, SwimlaneMode, KanbanConfig, KanbanMoveResult, KanbanSuggestion } from './kanban-types.js';
export { validateMove } from './kanban-validator.js';
