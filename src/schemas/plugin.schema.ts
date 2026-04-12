import { z } from "zod/v4";

export const PluginCapabilitySchema = z.enum([
  "analyzer",
  "validator",
  "template",
  "tool",
  "classifier_pattern",
  "knowledge_source",
  "event_handler",
]);

export const PluginManifestSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string(),
  author: z.string().optional(),
  repository: z.string().url().optional(),
  entryPoint: z.string(),
  capabilities: z.array(PluginCapabilitySchema).min(1),
  requires: z.object({
    mcpGraphVersion: z.string().optional(),
    plugins: z.array(z.string()).optional(),
  }).optional(),
  conflicts: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type PluginCapability = z.infer<typeof PluginCapabilitySchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
