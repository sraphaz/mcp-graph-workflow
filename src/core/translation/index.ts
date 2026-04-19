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

export { splitAtBoundaries, analyzeChunked } from './chunked-analyzer.js';
export { detectLanguageFromCode } from './language-detect.js';
export type { LanguageDetectionResult } from './language-detect.js';
export { analyzeFromIndex } from './pre-indexed-analyzer.js';
export type { PreIndexedResult } from './pre-indexed-analyzer.js';
export { ProjectTranslationOrchestrator } from './project-translation-orchestrator.js';
export { buildMappingPrompt, buildTranslationPrompt, buildSyntacticRepairPrompt, buildSemanticRepairPrompt } from './prompt-builder.js';
export type { PromptContext } from './prompt-builder.js';
export { paginatePrompt } from './prompt-paginator.js';
export type { PromptPage } from './prompt-paginator.js';
export { TranslationOrchestrator } from './translation-orchestrator.js';
export { TranslationProjectStore } from './translation-project-store.js';
export { TranslationProjectStatusSchema, TranslationProjectFileStatusSchema, TranslationProjectSchema, TranslationProjectFileSchema, CreateTranslationProjectInputSchema, AddTranslationProjectFileInputSchema, ExtractedFileSchema, TranslationProjectSummarySchema } from './translation-project-types.js';
export type { TranslationProjectStatus, TranslationProjectFileStatus, TranslationProject, TranslationProjectFile, CreateTranslationProjectInput, AddTranslationProjectFileInput, ExtractedFile, TranslationProjectSummary } from './translation-project-types.js';
export { TranslationStore } from './translation-store.js';
export type { CreateJobInput, UpdateJobInput } from './translation-store.js';
export { TranslationJobStatusSchema, TranslationScopeSchema, TranslationJobSchema, TranslationConstructInfoSchema, TranslationAnalysisSchema, TranslationMetricsSchema, TranslationMappingReportSchema, TranslationResultSchema, EvidenceTranslatedConstructSchema, EvidenceRiskSchema, EvidencePackSchema } from './translation-types.js';
export type { TranslationJobStatus, TranslationScope, TranslationJob, TranslationConstructInfo, TranslationAnalysis, TranslationMetrics, TranslationMappingReport, TranslationResult, EvidencePack } from './translation-types.js';
export { detectLanguageByExtension, extractZip } from './zip-extractor.js';
