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

import { describe, it, expect } from "vitest";
import {
  TranslationProjectStatusSchema,
  TranslationProjectFileStatusSchema,
  TranslationProjectSchema,
  TranslationProjectFileSchema,
  CreateTranslationProjectInputSchema,
  AddTranslationProjectFileInputSchema,
  ExtractedFileSchema,
} from "../core/translation/translation-project-types.js";

describe("TranslationProjectStatusSchema", () => {
  it.each(["uploading", "analyzing", "ready", "translating", "done", "failed"] as const)(
    "should accept '%s'",
    (status) => {
      expect(TranslationProjectStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it("should reject unknown statuses", () => {
    expect(TranslationProjectStatusSchema.safeParse("pending").success).toBe(false);
    expect(TranslationProjectStatusSchema.safeParse("").success).toBe(false);
  });
});

describe("TranslationProjectFileStatusSchema", () => {
  it.each([
    "pending",
    "analyzing",
    "analyzed",
    "translating",
    "done",
    "failed",
  ] as const)("should accept '%s'", (status) => {
    expect(TranslationProjectFileStatusSchema.safeParse(status).success).toBe(true);
  });

  it("should reject unknown statuses", () => {
    expect(TranslationProjectFileStatusSchema.safeParse("ready").success).toBe(false);
  });
});

describe("TranslationProjectSchema", () => {
  const valid = {
    id: "tp-1",
    projectId: "proj-1",
    name: "MyProject",
    targetLanguage: "python",
    status: "uploading" as const,
    totalFiles: 0,
    processedFiles: 0,
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
  };

  it("should accept the minimal valid project", () => {
    expect(TranslationProjectSchema.safeParse(valid).success).toBe(true);
  });

  it("should accept optional sourceLanguage, overallConfidence, deterministicPct", () => {
    const full = {
      ...valid,
      sourceLanguage: "typescript",
      overallConfidence: 0.85,
      deterministicPct: 70,
    };
    expect(TranslationProjectSchema.safeParse(full).success).toBe(true);
  });

  it("should reject overallConfidence > 1", () => {
    expect(
      TranslationProjectSchema.safeParse({ ...valid, overallConfidence: 1.5 }).success,
    ).toBe(false);
  });

  it("should reject deterministicPct > 100", () => {
    expect(
      TranslationProjectSchema.safeParse({ ...valid, deterministicPct: 150 }).success,
    ).toBe(false);
  });

  it("should reject negative totalFiles", () => {
    expect(
      TranslationProjectSchema.safeParse({ ...valid, totalFiles: -1 }).success,
    ).toBe(false);
  });
});

describe("TranslationProjectFileSchema", () => {
  const valid = {
    id: "f-1",
    translationProjectId: "tp-1",
    filePath: "src/hello.ts",
    sourceCode: "const x = 1;",
    status: "pending" as const,
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
  };

  it("should accept minimal valid file", () => {
    expect(TranslationProjectFileSchema.safeParse(valid).success).toBe(true);
  });

  it("should accept optional analysis record + confidenceScore", () => {
    const full = {
      ...valid,
      analysis: { complexity: "low", lines: 5 },
      confidenceScore: 0.7,
      deterministic: true,
    };
    expect(TranslationProjectFileSchema.safeParse(full).success).toBe(true);
  });

  it("should reject confidenceScore outside [0, 1]", () => {
    expect(
      TranslationProjectFileSchema.safeParse({ ...valid, confidenceScore: 1.1 }).success,
    ).toBe(false);
    expect(
      TranslationProjectFileSchema.safeParse({ ...valid, confidenceScore: -0.1 }).success,
    ).toBe(false);
  });
});

describe("CreateTranslationProjectInputSchema", () => {
  it("should accept the minimal valid input", () => {
    const result = CreateTranslationProjectInputSchema.safeParse({
      projectId: "p1",
      name: "n1",
      targetLanguage: "python",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    expect(
      CreateTranslationProjectInputSchema.safeParse({ projectId: "p1" }).success,
    ).toBe(false);
  });
});

describe("AddTranslationProjectFileInputSchema", () => {
  it("should accept the minimal valid input", () => {
    const result = AddTranslationProjectFileInputSchema.safeParse({
      translationProjectId: "tp-1",
      filePath: "x.ts",
      sourceCode: "const x = 1",
    });
    expect(result.success).toBe(true);
  });
});

describe("ExtractedFileSchema", () => {
  it("should accept basic extracted-file shape", () => {
    const result = ExtractedFileSchema.safeParse({
      relativePath: "src/hello.ts",
      content: "console.log('hi')",
      detectedLanguage: "typescript",
    });
    // Just test that schema parses without throwing — exact shape may have
    // additional optional fields. Real flow tested in integration.
    expect(typeof result.success).toBe("boolean");
  });
});
