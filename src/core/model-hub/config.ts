/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-model-hub — model-hub.config.json schema (Task 1.1)
 * Zod v4 schema for model-hub configuration.
 * Backends are validated at parse time; duplicate model keys are allowed
 * via @backend suffix disambiguation (AC3).
 */

import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Known backends
// ---------------------------------------------------------------------------

export const BackendNameSchema = z.enum(["vllm", "exllama", "llamacpp", "ollama"]);
export type BackendName = z.infer<typeof BackendNameSchema>;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const ModelHubConfigSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.number().int().min(1).max(65535).default(11434),
  backends: z.array(BackendNameSchema).min(1),
  models: z.record(z.string(), BackendNameSchema),
  fallbackChain: z.array(BackendNameSchema),
});

export type ModelHubConfig = z.infer<typeof ModelHubConfigSchema>;
