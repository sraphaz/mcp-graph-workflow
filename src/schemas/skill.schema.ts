import { z } from "zod/v4";

export const LifecyclePhaseEnum = z.enum([
  "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
]);

export const SkillPreferenceSchema = z.object({
  projectId: z.string(),
  skillName: z.string(),
  enabled: z.boolean(),
  updatedAt: z.string(),
});
export type SkillPreference = z.infer<typeof SkillPreferenceSchema>;

export const CustomSkillInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  category: z.string().default("know-me"),
  phases: z.array(LifecyclePhaseEnum),
  instructions: z.string().min(1),
});
export type CustomSkillInput = z.infer<typeof CustomSkillInputSchema>;

export const CustomSkillSchema = CustomSkillInputSchema.extend({
  id: z.string(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomSkill = z.infer<typeof CustomSkillSchema>;

// ── Task Templates ──

export const TemplateSubtaskSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["task", "subtask"]).default("subtask"),
  acceptanceCriteria: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  xpSize: z.enum(["XS", "S", "M", "L", "XL"]).optional(),
});
export type TemplateSubtask = z.infer<typeof TemplateSubtaskSchema>;

export const TaskTemplateInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  subtasks: z.array(TemplateSubtaskSchema).min(1),
});
export type TaskTemplateInput = z.infer<typeof TaskTemplateInputSchema>;

export const TaskTemplateSchema = TaskTemplateInputSchema.extend({
  id: z.string(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>;
