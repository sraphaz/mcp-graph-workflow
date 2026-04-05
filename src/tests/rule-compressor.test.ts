import { describe, it, expect } from "vitest";
import {
  jaccardSimilarity,
  compressBullets,
  compressSummary,
  compressSteps,
  compressJson,
} from "../core/context/rule-compressor.js";

describe("jaccardSimilarity", () => {
  it("should return 1.0 for identical strings", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1.0);
  });

  it("should return 0.0 for completely different strings", () => {
    expect(jaccardSimilarity("a b c", "d e f")).toBe(0.0);
  });

  it("should return 0 for two empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(0);
  });

  it("should be case-insensitive", () => {
    expect(jaccardSimilarity("The Quick Brown", "the quick brown")).toBe(1.0);
  });

  it("should return 0 when one string is empty and other is not", () => {
    expect(jaccardSimilarity("hello", "")).toBe(0);
    expect(jaccardSimilarity("", "world")).toBe(0);
  });

  it("should handle partial overlap correctly", () => {
    // "hello world" tokens: {hello, world}
    // "hello earth" tokens: {hello, earth}
    // intersection: {hello} = 1, union: {hello, world, earth} = 3
    // jaccard = 1/3
    const result = jaccardSimilarity("hello world", "hello earth");
    expect(result).toBeCloseTo(1 / 3, 5);
  });

  it("should ignore extra whitespace", () => {
    expect(jaccardSimilarity("  hello   world  ", "hello world")).toBe(1.0);
  });

  it("should handle single-token strings", () => {
    expect(jaccardSimilarity("hello", "hello")).toBe(1.0);
    expect(jaccardSimilarity("hello", "world")).toBe(0.0);
  });
});

describe("compressBullets", () => {
  it("should deduplicate sentences with Jaccard similarity >0.7", () => {
    const text = [
      "The quick brown fox jumps over the lazy dog.",
      "The quick brown fox jumps over the lazy cat.",
      "A completely different sentence about programming.",
    ].join(" ");

    const result = compressBullets(text, 500);
    const lines = result.split("\n").filter(Boolean);

    // The first two sentences are very similar (Jaccard >0.7) — keep only the first
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^- /);
    expect(lines[1]).toMatch(/^- /);
  });

  it("should format output as bullet list with - prefix", () => {
    const text = "First sentence here. Second sentence here too.";
    const result = compressBullets(text, 500);
    const lines = result.split("\n").filter(Boolean);

    for (const line of lines) {
      expect(line).toMatch(/^- /);
    }
  });

  it("should respect maxTokens limit", () => {
    // Create a long text that exceeds 100 tokens (~400 chars)
    const sentences = Array.from(
      { length: 20 },
      (_, i) => `This is unique sentence number ${i} with enough words to consume tokens.`
    );
    const text = sentences.join(" ");

    const result = compressBullets(text, 100);
    // ~4 chars per token, so 100 tokens ≈ 400 chars max
    expect(result.length).toBeLessThanOrEqual(400);
  });

  it("should filter out sentences shorter than 20 chars", () => {
    const text = "OK. Yes. No way. This is a proper sentence with enough length.";
    const result = compressBullets(text, 500);
    const lines = result.split("\n").filter(Boolean);

    // Only the last sentence has >=20 chars
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("proper sentence");
  });

  it("should return empty string for empty input", () => {
    expect(compressBullets("", 500)).toBe("");
  });

  it("should handle text with only short sentences", () => {
    const text = "Hi. OK. No. Yes.";
    const result = compressBullets(text, 500);
    expect(result).toBe("");
  });

  it("should keep three distinct sentences when none are similar", () => {
    const text = [
      "TypeScript is a strongly typed language.",
      "Docker containers isolate application environments.",
      "PostgreSQL supports advanced JSON operations.",
    ].join(" ");

    const result = compressBullets(text, 500);
    const lines = result.split("\n").filter(Boolean);

    expect(lines).toHaveLength(3);
  });
});

describe("compressSummary", () => {
  it("should extract topic sentence (first sentence) from each paragraph", () => {
    const text = [
      "TypeScript is a typed superset of JavaScript. It compiles to plain JS. Many developers prefer it.",
      "Docker simplifies deployment workflows. Containers are lightweight. They share the host OS kernel.",
      "PostgreSQL is a powerful relational database. It supports JSON and full-text search. Extensions are available.",
      "Redis provides in-memory data storage. It supports pub/sub patterns. Persistence options exist.",
      "Kubernetes orchestrates container workloads. It handles scaling automatically. Service discovery is built-in.",
    ].join("\n\n");

    const result = compressSummary(text, 2000);

    expect(result).toContain("TypeScript is a typed superset of JavaScript");
    expect(result).toContain("Docker simplifies deployment workflows");
    expect(result).toContain("PostgreSQL is a powerful relational database");
    expect(result).toContain("Redis provides in-memory data storage");
    expect(result).toContain("Kubernetes orchestrates container workloads");
    // Should NOT contain non-topic sentences
    expect(result).not.toContain("It compiles to plain JS");
    expect(result).not.toContain("Containers are lightweight");
  });

  it("should deduplicate similar topic sentences using Jaccard >0.7", () => {
    const text = [
      "The system processes incoming HTTP requests efficiently and routes them to handlers.",
      "The system processes incoming HTTP requests efficiently and dispatches them to handlers.",
      "Redis caches frequently accessed data for performance optimization.",
    ].join("\n\n");

    const result = compressSummary(text, 2000);
    const lines = result.split("\n").filter(Boolean);

    // First two paragraphs have very similar topic sentences — dedup to 1
    expect(lines).toHaveLength(2);
    expect(result).toContain("The system processes incoming HTTP requests");
    expect(result).toContain("Redis caches frequently accessed data");
  });

  it("should respect maxTokens budget", () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) => `Unique paragraph number ${i} discusses a completely different topic with sufficient detail. More details follow here.`
    );
    const text = paragraphs.join("\n\n");

    const result = compressSummary(text, 50);
    // 50 tokens ≈ 200 chars — should not include all 20 topic sentences
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return empty string for empty input", () => {
    expect(compressSummary("", 500)).toBe("");
    expect(compressSummary("   ", 500)).toBe("");
  });

  it("should handle single paragraph", () => {
    const text = "This is a single paragraph with one topic sentence. And some more details after it.";
    const result = compressSummary(text, 500);

    expect(result).toContain("This is a single paragraph with one topic sentence");
  });

  it("should join topic sentences with newlines", () => {
    const text = [
      "TypeScript provides static type checking for JavaScript applications. More details follow.",
      "Redis handles caching and pub/sub messaging patterns efficiently. Additional info here.",
    ].join("\n\n");

    const result = compressSummary(text, 2000);
    const lines = result.split("\n").filter(Boolean);

    expect(lines).toHaveLength(2);
  });
});

describe("compressSteps", () => {
  it("should extract numbered steps from text", () => {
    const text = "1. Install dependencies\n2. Configure the database\n3. Run migrations\n4. Start the server";
    const result = compressSteps(text, 2000);

    expect(result).toContain("1. Install dependencies");
    expect(result).toContain("2. Configure the database");
    expect(result).toContain("3. Run migrations");
    expect(result).toContain("4. Start the server");
  });

  it("should extract bullet points from text", () => {
    const text = "Some intro text here.\n- First bullet point item\n- Second bullet point item\n- Third bullet point item\nSome trailing text.";
    const result = compressSteps(text, 2000);

    expect(result).toContain("- First bullet point item");
    expect(result).toContain("- Second bullet point item");
    expect(result).toContain("- Third bullet point item");
    // Should not include non-step lines
    expect(result).not.toContain("Some intro text");
    expect(result).not.toContain("Some trailing text");
  });

  it("should handle mixed numbered and bullet steps", () => {
    const text = "1. First step\n2. Second step\n- Extra bullet\n3. Third step";
    const result = compressSteps(text, 2000);

    expect(result).toContain("1. First step");
    expect(result).toContain("2. Second step");
    expect(result).toContain("- Extra bullet");
    expect(result).toContain("3. Third step");
  });

  it("should respect maxTokens budget", () => {
    const steps = Array.from(
      { length: 30 },
      (_, i) => `${i + 1}. This is step number ${i + 1} with enough words to consume token budget`
    ).join("\n");

    const result = compressSteps(steps, 50);
    // 50 tokens ≈ 200 chars
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return empty string for text without steps", () => {
    const text = "This is just a plain paragraph without any steps or bullets.";
    const result = compressSteps(text, 2000);
    expect(result).toBe("");
  });

  it("should return empty string for empty input", () => {
    expect(compressSteps("", 500)).toBe("");
  });
});

describe("compressJson", () => {
  it("should convert markdown headers to JSON keys", () => {
    const text = "## Installation\nRun npm install to get started.\n## Configuration\nEdit the config file.\n## Usage\nStart with npm run dev.";
    const result = compressJson(text, 2000);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty("Installation");
    expect(parsed).toHaveProperty("Configuration");
    expect(parsed).toHaveProperty("Usage");
    expect(parsed.Installation).toContain("Run npm install");
    expect(parsed.Configuration).toContain("Edit the config file");
    expect(parsed.Usage).toContain("Start with npm run dev");
  });

  it("should handle different header levels (# ## ###)", () => {
    const text = "# Main Title\nIntro content.\n## Section A\nSection A content.\n### Subsection\nSubsection content.";
    const result = compressJson(text, 2000);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty("Main Title");
    expect(parsed).toHaveProperty("Section A");
    expect(parsed).toHaveProperty("Subsection");
  });

  it("should fallback to points array for text without headers", () => {
    const text = "First sentence about TypeScript. Second sentence about testing. Third sentence about deployment.";
    const result = compressJson(text, 2000);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty("points");
    expect(parsed).toHaveProperty("total_sentences");
    expect(Array.isArray(parsed.points)).toBe(true);
    expect(parsed.total_sentences).toBe(3);
  });

  it("should respect maxTokens budget", () => {
    const sections = Array.from(
      { length: 20 },
      (_, i) => `## Section ${i}\nThis section contains enough words to consume a significant token budget for testing purposes.`
    ).join("\n");

    const result = compressJson(sections, 80);
    // Should still be valid JSON even if truncated
    expect(() => JSON.parse(result)).not.toThrow();
    expect(result.length).toBeLessThanOrEqual(320);
  });

  it("should return empty JSON object for empty input", () => {
    const result = compressJson("", 500);
    expect(JSON.parse(result)).toEqual({});
  });

  it("should produce valid JSON output", () => {
    const text = "## Test\nSome 'quoted' content with \"double quotes\" and special chars: <>&";
    const result = compressJson(text, 2000);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
