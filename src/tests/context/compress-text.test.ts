import { describe, it, expect } from "vitest";
import { compressText, type CompressFormat } from "../../core/context/compress-text.js";

describe("compressText", () => {
  it("should compress text with bullets format", () => {
    const result = compressText("Hello world. This is a test.", "bullets", 100);
    expect(result.compressed).toBeDefined();
    expect(typeof result.compressed).toBe("string");
    expect(result.stats.format).toBe("bullets");
  });

  it("should compress text with summary format", () => {
    const result = compressText("Hello world. This is a test.", "summary", 100);
    expect(result.compressed).toBeDefined();
    expect(result.stats.format).toBe("summary");
  });

  it("should compress text with steps format", () => {
    const result = compressText("Step 1: Do this. Step 2: Do that.", "steps", 100);
    expect(result.compressed).toBeDefined();
    expect(result.stats.format).toBe("steps");
  });

  it("should compress text with json format", () => {
    const result = compressText("# Title\nSome content here.", "json", 100);
    expect(result.compressed).toBeDefined();
    expect(result.stats.format).toBe("json");
  });

  it("should return empty result for empty text", () => {
    const result = compressText("", "bullets", 100);
    expect(result.compressed).toBe("");
    expect(result.stats.input_tokens).toBe(0);
    expect(result.stats.output_tokens).toBe(0);
  });

  it("should return empty result for whitespace-only text", () => {
    const result = compressText("   \n  ", "bullets", 100);
    expect(result.compressed).toBe("");
  });

  it("should return original text for unknown format (default case)", () => {
    const unknownFormat = "unknown_format" as CompressFormat;
    const text = "This text should be returned as-is for unknown format.";
    const result = compressText(text, unknownFormat, 100);
    expect(result.compressed).toBe(text);
    expect(result.stats.format).toBe(unknownFormat);
  });

  it("should calculate reduction percent correctly", () => {
    const longText = "word ".repeat(200);
    const result = compressText(longText, "bullets", 50);
    expect(result.stats.input_tokens).toBeGreaterThan(0);
    expect(result.stats.reduction_percent).toBeGreaterThanOrEqual(0);
    expect(result.stats.reduction_percent).toBeLessThanOrEqual(100);
  });
});
