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

export { DreamEngine } from './dream-engine.js';
export { saveDreamCycle, updateDreamCycle, getDreamCycle, listDreamCycles, archiveDreamDoc, listDreamArchive } from './dream-store.js';
export type { DreamArchiveEntry } from './dream-store.js';
export { DreamPhaseSchema, DreamCycleStatusSchema, DreamCycleConfigSchema, DEFAULT_DREAM_CONFIG, NremPhaseResultSchema, RemPhaseResultSchema, WakeReadyResultSchema, DreamSummarySchema, DreamCycleResultSchema, DreamStatusSchema } from './dream-types.js';
export type { DreamPhase, DreamCycleStatus, DreamCycleConfig, NremPhaseResult, RemPhaseResult, WakeReadyResult, DreamSummary, DreamCycleResult, DreamStatus } from './dream-types.js';
