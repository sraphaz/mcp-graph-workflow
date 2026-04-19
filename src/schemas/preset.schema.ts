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

const LifecyclePhaseEnum = z.enum([
  "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT",
  "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
]);

const StrictnessEnum = z.enum(["strict", "advisory"]);
const CodeIntelligenceEnum = z.enum(["strict", "advisory", "off"]);
const PrerequisitesEnum = z.enum(["strict", "advisory", "off"]);

export const PresetLifecycleSchema = z.object({
  phases: z.array(LifecyclePhaseEnum).optional(),
  strictness: StrictnessEnum.optional(),
  codeIntelligence: CodeIntelligenceEnum.optional(),
  prerequisites: PrerequisitesEnum.optional(),
}).optional();

export const PresetDodSchema = z.object({
  checks: z.record(z.string(), z.boolean()).optional(),
  customChecks: z.array(z.object({
    name: z.string(),
    description: z.string(),
    phase: z.string(),
    condition: z.string(),
  })).optional(),
}).optional();

export const PresetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string(),
  extends: z.string().optional(),
  lifecycle: PresetLifecycleSchema,
  dod: PresetDodSchema,
  classifierPatterns: z.record(z.string(), z.array(z.string())).optional(),
  templates: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type PresetDefinition = z.infer<typeof PresetSchema>;
export type PresetLifecycle = z.infer<typeof PresetLifecycleSchema>;
export type PresetDod = z.infer<typeof PresetDodSchema>;
