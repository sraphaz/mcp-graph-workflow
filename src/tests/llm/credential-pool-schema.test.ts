/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Schema Zod CredentialPoolEntry
 *
 * AC1: GIVEN entry válida com api_key + providerId WHEN parse THEN retorna tipo inferido sem campo `apiKey`
 * AC2: GIVEN entry com kind=oauth_bearer sem expiresAt WHEN parse THEN erro Zod
 * AC3: GIVEN errorCount negativo WHEN parse THEN erro Zod
 * AC4: GIVEN secretRef = "" WHEN parse THEN erro Zod
 */

import { describe, it, expect } from "vitest";
import { CredentialPoolEntrySchema } from "../../core/llm/credential-pool-schema.js";

const validApiKey = {
  providerId: "openai",
  secretRef: "secret:openai-prod-key",
  kind: "api_key" as const,
};

const validOAuthBearer = {
  providerId: "google",
  secretRef: "secret:google-oauth-token",
  kind: "oauth_bearer" as const,
  expiresAt: Date.now() + 3600_000,
};

// ---------------------------------------------------------------------------
// AC1: valid api_key entry — no apiKey field in result
// ---------------------------------------------------------------------------

describe("CredentialPoolEntry — AC1: valid api_key entry", () => {
  it("should parse a valid api_key entry", () => {
    const result = CredentialPoolEntrySchema.safeParse(validApiKey);
    expect(result.success).toBe(true);
  });

  it("should not expose any raw key field in the parsed output", () => {
    const result = CredentialPoolEntrySchema.safeParse(validApiKey);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("apiKey");
    expect(result.data).not.toHaveProperty("key");
    expect(result.data).not.toHaveProperty("secret");
  });

  it("should default errorCount to 0 when not provided", () => {
    const result = CredentialPoolEntrySchema.safeParse(validApiKey);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.errorCount).toBe(0);
  });

  it("should accept optional rateLimitWindow", () => {
    const result = CredentialPoolEntrySchema.safeParse({
      ...validApiKey,
      rateLimitWindow: { tokensPerMinute: 100_000, requestsPerMinute: 60 },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC2: oauth_bearer without expiresAt → Zod error
// ---------------------------------------------------------------------------

describe("CredentialPoolEntry — AC2: oauth_bearer requires expiresAt", () => {
  it("should reject oauth_bearer entry without expiresAt", () => {
    const result = CredentialPoolEntrySchema.safeParse({
      providerId: "google",
      secretRef: "secret:google-oauth-token",
      kind: "oauth_bearer",
    });
    expect(result.success).toBe(false);
  });

  it("should accept oauth_bearer entry with expiresAt", () => {
    const result = CredentialPoolEntrySchema.safeParse(validOAuthBearer);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3: errorCount negative → Zod error
// ---------------------------------------------------------------------------

describe("CredentialPoolEntry — AC3: errorCount must be non-negative", () => {
  it("should reject negative errorCount", () => {
    const result = CredentialPoolEntrySchema.safeParse({ ...validApiKey, errorCount: -1 });
    expect(result.success).toBe(false);
  });

  it("should accept errorCount of 0", () => {
    const result = CredentialPoolEntrySchema.safeParse({ ...validApiKey, errorCount: 0 });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC4: secretRef = "" → Zod error
// ---------------------------------------------------------------------------

describe("CredentialPoolEntry — AC4: secretRef cannot be empty", () => {
  it("should reject empty secretRef", () => {
    const result = CredentialPoolEntrySchema.safeParse({ ...validApiKey, secretRef: "" });
    expect(result.success).toBe(false);
  });

  it("should accept non-empty secretRef", () => {
    const result = CredentialPoolEntrySchema.safeParse({ ...validApiKey, secretRef: "secret:ref" });
    expect(result.success).toBe(true);
  });
});
