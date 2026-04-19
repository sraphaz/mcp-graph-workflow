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
import { NodeTypeSchema } from "./node.schema.js";

const SHORT_TEXT_MAX = 500;
const LONG_TEXT_MAX = 10_000;
const ARRAY_MAX = 100;

export const SpecTemplateVariableSchema = z.object({
  description: z.string().max(LONG_TEXT_MAX),
  type: z.enum(["string", "number", "boolean", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.string().max(SHORT_TEXT_MAX)).max(ARRAY_MAX).optional(),
  default: z.unknown().optional(),
});

export const SpecTemplateSectionSchema = z.object({
  title: z.string().max(SHORT_TEXT_MAX),
  description: z.string().max(LONG_TEXT_MAX),
  required: z.boolean().default(true),
  placeholder: z.string().max(LONG_TEXT_MAX).optional(),
  outputNodeType: NodeTypeSchema.optional(),
  validationRules: z.array(z.string().max(SHORT_TEXT_MAX)).max(ARRAY_MAX).optional(),
});

export const SpecTemplateSchema = z.object({
  name: z.string().min(1).max(SHORT_TEXT_MAX),
  phase: z.enum(["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "REVIEW"]),
  description: z.string().max(LONG_TEXT_MAX),
  sections: z.array(SpecTemplateSectionSchema).max(ARRAY_MAX),
  variables: z.record(z.string().max(SHORT_TEXT_MAX), SpecTemplateVariableSchema).optional(),
  constitution: z.boolean().optional().default(false),
});

export type SpecTemplateVariable = z.infer<typeof SpecTemplateVariableSchema>;
export type SpecTemplateSection = z.infer<typeof SpecTemplateSectionSchema>;
export type SpecTemplate = z.infer<typeof SpecTemplateSchema>;
