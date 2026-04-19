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

export { getNodeAcTexts, getNodeAcFromStore, nodeHasAc } from './ac-helpers.js';
export { checkCircularity } from './circularity.js';
export { STORE_DIR, DB_FILE, GLOBAL_STORE_DIR, GLOBAL_DB_DIR, GLOBAL_DB_PATH, GLOBAL_MEMORIES_DIR, GLOBAL_CONFIG_FILE, BOOTSTRAP_TOOLS, ALWAYS_ALLOWED_TOOLS, READ_ONLY_TOOLS, DEFAULT_NODE_STATUS, DEFAULT_NODE_PRIORITY, DEFAULT_TOKEN_BUDGET, DEFAULT_CHUNK_MAX_TOKENS, DEFAULT_CHUNK_OVERLAP, SUPPORTED_LANGUAGES, SUPPORTED_LANGUAGE_PAIRS, MVP_LANGUAGE_PAIRS, UCR_CONFIDENCE_THRESHOLD, isLanguageSupported, isLanguagePairSupported } from './constants.js';
export type { SupportedLanguage } from './constants.js';
export { checkEpicPromotion, autoPromoteEpic, cascadeDownOnDone } from './epic-promotion.js';
export type { EpicPromotionResult, AutoPromoteResult, CascadeDownResult } from './epic-promotion.js';
export { McpGraphError, FileNotFoundError, GraphNotInitializedError, NodeNotFoundError, ValidationError, SnapshotNotFoundError, getErrorMessage, TranslationError, UnsupportedLanguagePairError, TranslationValidationError, OnnxModelNotFoundError, ConflictError, LockConflictError, PlannerError, GraphIntegrityError, ContextBuildError, DeployReadinessError, LifecycleGateError } from './errors.js';
export type { ConflictDetails, LockConflictDetails } from './errors.js';
export { fileExists, safeReadFileSync, assertPathInsideProject } from './fs.js';
export { scoreToGrade } from './grading.js';
export type { Grade } from './grading.js';
export { generateId } from './id.js';
export { getLogBuffer, clearLogBuffer, setLogListener, logger } from './logger.js';
export { TASK_TYPES, REQUIREMENT_TYPES, DESIGN_TYPES, DESIGN_ONLY_TYPES, FEEDBACK_TYPES } from './node-type-sets.js';
export { safeParseInt } from './parse-query.js';
export type { ParseIntResult } from './parse-query.js';
export { IS_WINDOWS, whichCommand, killProcess } from './platform.js';
export { PathTraversalError, assertPathInside } from './safe-path.js';
export { tokenize, jaccardSimilarity } from './similarity.js';
export { normalizeNewlines } from './text.js';
export { now } from './time.js';
export { XP_SIZE_ORDER, XP_SIZE_POINTS } from './xp-sizing.js';
