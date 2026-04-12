import { z } from "zod/v4";
import { NodeTypeSchema } from "./node.schema.js";

export const SpecTemplateVariableSchema = z.object({
  description: z.string(),
  type: z.enum(["string", "number", "boolean", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  default: z.unknown().optional(),
});

export const SpecTemplateSectionSchema = z.object({
  title: z.string(),
  description: z.string(),
  required: z.boolean().default(true),
  placeholder: z.string().optional(),
  outputNodeType: NodeTypeSchema.optional(),
  validationRules: z.array(z.string()).optional(),
});

export const SpecTemplateSchema = z.object({
  name: z.string().min(1),
  phase: z.enum(["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "REVIEW"]),
  description: z.string(),
  sections: z.array(SpecTemplateSectionSchema),
  variables: z.record(z.string(), SpecTemplateVariableSchema).optional(),
  constitution: z.boolean().optional().default(false),
});

export type SpecTemplateVariable = z.infer<typeof SpecTemplateVariableSchema>;
export type SpecTemplateSection = z.infer<typeof SpecTemplateSectionSchema>;
export type SpecTemplate = z.infer<typeof SpecTemplateSchema>;
