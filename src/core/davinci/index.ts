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

export { checkBuildEnvironment, scaffoldMavenProject, runMavenBuild } from './build-runner.js';
export type { EnvironmentItem, BuildEnvironment, ScaffoldOptions, ScaffoldResult } from './build-runner.js';
export { parseDaVinciCode } from './davinci-parser.js';
export type { ParseOptions } from './davinci-parser.js';
export { DaVinciStore } from './davinci-store.js';
export type { DaVinciJob, CreateJobInput } from './davinci-store.js';
export { DaVinciVariableKindSchema, DaVinciVariableSchema, DaVinciCodeLocationSchema, PfPluginTypeSchema, PF_INF_DIRECTORY_MAP, DaVinciApiCallSchema, DaVinciFlowLogicSchema, DaVinciAnalysisSchema, DaVinciJobStatusSchema, DaVinciConversionJobSchema, ResolvedVariableSchema, PluginGenerationConfigSchema, BuildResultSchema } from './davinci-types.js';
export type { DaVinciVariableKind, DaVinciVariable, DaVinciCodeLocation, PfPluginType, DaVinciApiCall, DaVinciFlowLogic, DaVinciAnalysis, DaVinciJobStatus, DaVinciConversionJob, ResolvedVariable, PluginGenerationConfig, BuildResult } from './davinci-types.js';
export { validatePreConversion, validatePostGeneration, validateBuildResult } from './davinci-validators.js';
export type { ValidationIssue, ValidationResult } from './davinci-validators.js';
export { generateGuiDescriptor, generateAttributeContract, generatePfInfDescriptor, generateMetaInfServices } from './descriptor-generator.js';
export type { GuiDescriptorResult, PfInfDescriptor } from './descriptor-generator.js';
export { validateJavaIdentifiers, validateAttributeContract, generatePlugin } from './plugin-generator.js';
export type { GeneratePluginOptions, GeneratePluginResult } from './plugin-generator.js';
export { detectPluginType } from './plugin-type-detector.js';
export type { TargetSdkMode, PaPluginType, DetectionResult, DetectionOptions } from './plugin-type-detector.js';
export { generatePom } from './pom-generator.js';
export type { TargetSdk } from './pom-generator.js';
export { getTemplate, listTemplates, renderTemplate } from './template-registry.js';
export type { PluginTemplate, TemplateContext } from './template-registry.js';
export { resolveVariable, resolveVariables, generateGuiFieldCode, generateConfigureCode } from './variable-resolver.js';
export type { ResolveOptions } from './variable-resolver.js';
