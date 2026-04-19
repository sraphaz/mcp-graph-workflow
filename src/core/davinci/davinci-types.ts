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

import { z } from "zod/v4";

// ── DaVinci Variable Schemas ──────────────────────────────────────────

export const DaVinciVariableKindSchema = z.enum([
  "global",       // {{global.variables.variableName}}
  "local",        // {{local.nodeId.capability.output.field}}
  "parameter",    // {{parameterName}} (Handlebars client-side)
  "flow",         // {{flow.variables.x}}
]);

export type DaVinciVariableKind = z.infer<typeof DaVinciVariableKindSchema>;

export const DaVinciVariableSchema = z.object({
  kind: DaVinciVariableKindSchema,
  rawTemplate: z.string(),
  path: z.array(z.string()),
  fieldName: z.string(),
  nodeId: z.string().optional(),
  capability: z.string().optional(),
});

export type DaVinciVariable = z.infer<typeof DaVinciVariableSchema>;

// ── DaVinci Code Location ─────────────────────────────────────────────

export const DaVinciCodeLocationSchema = z.enum([
  "custom_function",
  "code_snippet",
  "html_template",
]);

export type DaVinciCodeLocation = z.infer<typeof DaVinciCodeLocationSchema>;

// ── PingAccess Plugin Types ───────────────────────────────────────────

export const PfPluginTypeSchema = z.enum([
  "idp-adapter",
  "sp-adapter",
  "token-generator",
  "token-processor",
  "access-grant-manager",
  "notification-publisher",
  "secret-manager",
  "password-credential-validator",
  "custom-data-store",
  "identity-store-provisioner",
]);

export type PfPluginType = z.infer<typeof PfPluginTypeSchema>;

// ── PF-INF Descriptor Mapping ─────────────────────────────────────────

export const PF_INF_DIRECTORY_MAP: Record<PfPluginType, string> = {
  "idp-adapter": "idp-authn-adapters",
  "sp-adapter": "sp-authn-adapters",
  "token-generator": "token-generators",
  "token-processor": "token-processors",
  "access-grant-manager": "access-grant-managers",
  "notification-publisher": "notification-publishers",
  "secret-manager": "secret-managers",
  "password-credential-validator": "password-credential-validators",
  "custom-data-store": "custom-data-stores",
  "identity-store-provisioner": "identity-store-provisioners",
};

// ── API Call Detection ────────────────────────────────────────────────

export const DaVinciApiCallSchema = z.object({
  method: z.string(),
  url: z.string().optional(),
  line: z.number(),
});

export type DaVinciApiCall = z.infer<typeof DaVinciApiCallSchema>;

// ── Flow Logic Detection ──────────────────────────────────────────────

export const DaVinciFlowLogicSchema = z.object({
  hasConditionals: z.boolean(),
  hasLoops: z.boolean(),
  hasJsonParse: z.boolean(),
  hasErrorHandling: z.boolean(),
  hasAsyncAwait: z.boolean(),
});

export type DaVinciFlowLogic = z.infer<typeof DaVinciFlowLogicSchema>;

// ── DaVinci Analysis Result ───────────────────────────────────────────

export const DaVinciAnalysisSchema = z.object({
  variables: z.array(DaVinciVariableSchema),
  codeLocation: DaVinciCodeLocationSchema,
  apiCalls: z.array(DaVinciApiCallSchema),
  flowLogic: DaVinciFlowLogicSchema,
  recommendedPluginType: PfPluginTypeSchema,
  pluginTypeConfidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  sourceLineCount: z.number(),
});

export type DaVinciAnalysis = z.infer<typeof DaVinciAnalysisSchema>;

// ── Conversion Job ────────────────────────────────────────────────────

export const DaVinciJobStatusSchema = z.enum([
  "analyzing",
  "converting",
  "building",
  "done",
  "failed",
]);

export type DaVinciJobStatus = z.infer<typeof DaVinciJobStatusSchema>;

export const DaVinciConversionJobSchema = z.object({
  id: z.string(),
  sourceCode: z.string(),
  analysis: DaVinciAnalysisSchema.optional(),
  generatedJava: z.string().optional(),
  generatedPom: z.string().optional(),
  pluginType: PfPluginTypeSchema,
  pluginName: z.string(),
  packageName: z.string(),
  className: z.string(),
  status: DaVinciJobStatusSchema,
  jarPath: z.string().optional(),
  buildOutput: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DaVinciConversionJob = z.infer<typeof DaVinciConversionJobSchema>;

// ── Variable Resolution Result ────────────────────────────────────────

export const ResolvedVariableSchema = z.object({
  original: DaVinciVariableSchema,
  javaExpression: z.string(),
  guiFieldCode: z.string().optional(),
  configureCode: z.string().optional(),
});

export type ResolvedVariable = z.infer<typeof ResolvedVariableSchema>;

// ── Plugin Generation Config ──────────────────────────────────────────

export const PluginGenerationConfigSchema = z.object({
  pluginName: z.string(),
  packageName: z.string(),
  className: z.string(),
  pluginType: PfPluginTypeSchema,
  attributeContract: z.array(z.string()),
  sdkPath: z.string().optional(),
  javaVersion: z.string().default("11"),
});

export type PluginGenerationConfig = z.infer<typeof PluginGenerationConfigSchema>;

// ── Build Result ──────────────────────────────────────────────────────

export const BuildResultSchema = z.object({
  success: z.boolean(),
  jarPath: z.string().optional(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number(),
});

export type BuildResult = z.infer<typeof BuildResultSchema>;
