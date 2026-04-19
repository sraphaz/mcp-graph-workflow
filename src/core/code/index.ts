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

export { createAnalyzers } from './analyzer-factory.js';
export { TEST_OR_DECL_PATTERN, CodeIndexer } from './code-indexer.js';
export { searchCodeSymbols } from './code-search.js';
export type { CodeSearchOptions } from './code-search.js';
export { CodeStore } from './code-store.js';
export { SymbolKindSchema, RelationTypeSchema, RiskLevelSchema, CodeSymbolSchema, CodeRelationSchema, CodeGraphDataSchema, AffectedSymbolSchema, ImpactResultSchema, CodeIndexMetaSchema, CodeSearchResultSchema, calculateRiskLevel } from './code-types.js';
export type { SymbolKind, CodeRelationType, RiskLevel, CodeSymbol, CodeRelation, CodeGraphData, AffectedSymbol, ImpactResult, CodeIndexMeta, CodeSearchResult, AnalyzedFile, DetectedChange, ChangeDetectionResult, DetectedProcess, CodeAnalyzer, IndexResult } from './code-types.js';
export { syncGraphFromCode } from './graph-sync.js';
export type { SyncReport } from './graph-sync.js';
export { getSymbolContext, analyzeImpact, getFullGraph, getSymbolContextSemantic } from './graph-traversal.js';
export { detectProcesses } from './process-detector.js';
export { resetTypeScriptLoader, isTypeScriptAvailable, analyzeFile, TsAnalyzer } from './ts-analyzer.js';
