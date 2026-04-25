/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { OcrService, shouldOcr } from "../core/journey/ocr-service.js";

describe("OcrService.shouldOcr", () => {
  it("returns false when helper is not screenshot", () => {
    expect(shouldOcr("navigate", "anything")).toBe(false);
    expect(shouldOcr("click", null)).toBe(false);
  });

  it("returns true when screenshot helper and DOM text is missing", () => {
    expect(shouldOcr("screenshot", null)).toBe(true);
    expect(shouldOcr("screenshot", "")).toBe(true);
    expect(shouldOcr("screenshot", "   ")).toBe(true);
  });

  it("returns true when DOM text is too short to be meaningful", () => {
    expect(shouldOcr("screenshot", "hi")).toBe(true);
    expect(shouldOcr("screenshot", "short text")).toBe(true);
  });

  it("returns false when DOM text is already rich", () => {
    const rich = "This is the landing page header with meaningful content for users.";
    expect(shouldOcr("screenshot", rich)).toBe(false);
  });
});

describe("OcrService", () => {
  it("constructs without loading tesseract (lazy)", () => {
    // Arrange + Act
    const svc = new OcrService({ lang: "eng" });

    // Assert
    expect(svc).toBeInstanceOf(OcrService);
    expect(svc.isLoaded()).toBe(false);
  });

  it("terminates cleanly when never used", async () => {
    // Arrange
    const svc = new OcrService();

    // Act
    await svc.terminate();

    // Assert
    expect(svc.isLoaded()).toBe(false);
  });
});
