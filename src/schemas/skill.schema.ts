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

const ID_MAX = 100;
const SHORT_TEXT_MAX = 500;
const LONG_TEXT_MAX = 10_000;
const ARRAY_MAX = 50;

export const LifecyclePhaseEnum = z.enum([
  "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
]);

export const SkillPreferenceSchema = z.object({
  projectId: z.string().max(ID_MAX),
  skillName: z.string().max(ID_MAX),
  enabled: z.boolean(),
  updatedAt: z.string(),
});
export type SkillPreference = z.infer<typeof SkillPreferenceSchema>;

export const SkillTriggerSchema = z.object({
  event: z.string().min(1).max(ID_MAX).describe("Event type that activates this skill"),
  condition: z.string().max(SHORT_TEXT_MAX).optional().describe("Optional condition expression"),
});
export type SkillTrigger = z.infer<typeof SkillTriggerSchema>;

export const CustomSkillInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(LONG_TEXT_MAX),
  category: z.string().max(ID_MAX).default("know-me"),
  phases: z.array(LifecyclePhaseEnum).max(ARRAY_MAX),
  instructions: z.string().min(1).max(LONG_TEXT_MAX),
  toolchain: z.array(z.string().max(ID_MAX)).max(ARRAY_MAX).optional().describe("Ordered list of tool names this skill uses"),
  triggers: z.array(SkillTriggerSchema).max(ARRAY_MAX).optional().describe("Events that auto-activate this skill"),
  contextTemplate: z.string().max(LONG_TEXT_MAX).optional().describe("Template for context injection"),
});
export type CustomSkillInput = z.infer<typeof CustomSkillInputSchema>;

export const CustomSkillSchema = CustomSkillInputSchema.extend({
  id: z.string().max(ID_MAX),
  projectId: z.string().max(ID_MAX),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomSkill = z.infer<typeof CustomSkillSchema>;

// ── Task Templates ──

export const TemplateSubtaskSchema = z.object({
  title: z.string().min(1).max(SHORT_TEXT_MAX),
  type: z.enum(["task", "subtask"]).default("subtask"),
  acceptanceCriteria: z.array(z.string().max(2000)).max(ARRAY_MAX).optional(),
  tags: z.array(z.string().max(ID_MAX)).max(ARRAY_MAX).optional(),
  xpSize: z.enum(["XS", "S", "M", "L", "XL"]).optional(),
});
export type TemplateSubtask = z.infer<typeof TemplateSubtaskSchema>;

export const TaskTemplateInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(LONG_TEXT_MAX),
  subtasks: z.array(TemplateSubtaskSchema).min(1).max(ARRAY_MAX),
});
export type TaskTemplateInput = z.infer<typeof TaskTemplateInputSchema>;

export const TaskTemplateSchema = TaskTemplateInputSchema.extend({
  id: z.string().max(ID_MAX),
  projectId: z.string().max(ID_MAX),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>;
