/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-credential-pool — Task 1.1: Zod schema for credential pool entries.
 * The raw API key/token NEVER appears here — secretRef is an opaque pointer
 * to a secret store resolved at runtime (Task 1.3).
 */

import { z } from "zod/v4";

const RateLimitWindowSchema = z.object({
  tokensPerMinute: z.number().int().positive(),
  requestsPerMinute: z.number().int().positive(),
});

export const CredentialPoolEntrySchema = z
  .object({
    providerId: z.string().min(1),
    secretRef: z.string().min(1),
    kind: z.enum(["api_key", "oauth_bearer"]),
    expiresAt: z.number().int().positive().optional(),
    rateLimitWindow: RateLimitWindowSchema.optional(),
    lastUsedAt: z.number().int().nonnegative().optional(),
    lastErrorAt: z.number().int().nonnegative().optional(),
    errorCount: z.number().int().nonnegative().default(0),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "oauth_bearer" && val.expiresAt === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "expiresAt is required for oauth_bearer credentials",
      });
    }
  });

export type CredentialPoolEntry = z.infer<typeof CredentialPoolEntrySchema>;
