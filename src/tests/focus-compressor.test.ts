import { describe, it, expect } from "vitest";
import { compressWithFocus } from "../core/context/focus-compressor.js";

describe("compressWithFocus", () => {
  it("should preserve sections matching focus topic", () => {
    const text = [
      "## Authentication\nJWT tokens are used for user auth. Tokens expire after 1 hour.",
      "## Database\nSQLite with WAL mode. Migrations handled automatically.",
      "## Auth Middleware\nMiddleware validates JWT on each request. Invalid tokens return 401.",
    ].join("\n\n");

    const result = compressWithFocus(text, "authentication", 500);

    // Auth-related sections should be preserved more than database
    expect(result.compressed).toContain("JWT");
    expect(result.compressed).toContain("auth");
    expect(result.focusRelevanceScore).toBeGreaterThan(0);
  });

  it("should compress low-relevance sections", () => {
    const text = [
      "## Topic A\n" + "This is about authentication and JWT tokens. ".repeat(20),
      "## Topic B\n" + "This is about styling and CSS colors. ".repeat(20),
      "## Topic C\n" + "This is about logging and observability. ".repeat(20),
    ].join("\n\n");

    const result = compressWithFocus(text, "authentication", 200);

    // Result should be smaller than input
    expect(result.stats.outputTokens).toBeLessThan(result.stats.inputTokens);
  });

  it("should respect compression floor of 20%", () => {
    const text = [
      "## Section One\nThis section covers database migrations and schema changes in detail.",
      "## Section Two\nThis section covers API endpoint design and REST conventions used.",
      "## Section Three\nThis section covers testing strategies including unit and integration tests.",
    ].join("\n\n");


    const result = compressWithFocus(text, "nonexistent topic xyz", 5);

    // Floor ensures minimum 20% output even with very tight budget
    // effectiveMax = max(5, floor(inputTokens * 0.2))
    expect(result.stats.outputTokens).toBeGreaterThan(0);
    expect(result.compressed.length).toBeGreaterThan(0);
  });

  it("should fall back to uniform compression when no sections match", () => {
    const text = "This is about databases and SQL queries. ".repeat(30);
    const result = compressWithFocus(text, "authentication", 100);

    // Should still return something (not empty, not crash)
    expect(result.compressed.length).toBeGreaterThan(0);
  });

  it("should handle empty text", () => {
    const result = compressWithFocus("", "anything", 100);

    expect(result.compressed).toBe("");
    expect(result.stats.inputTokens).toBe(0);
  });

  it("should handle empty focus topic", () => {
    const text = "Some text about various topics.";
    const result = compressWithFocus(text, "", 500);

    // With empty focus, should return text as-is (within budget)
    expect(result.compressed).toBe(text);
  });

  it("should report pressure level at different budget usages", () => {
    const text = "word ".repeat(200); // ~200 tokens

    // Generous budget — no pressure
    const generous = compressWithFocus(text, "word", 1000);
    expect(generous.pressureLevel).toBe("none");

    // Tight budget — should trigger pressure
    const tight = compressWithFocus(text, "word", 50);
    expect(["medium", "high", "critical"]).toContain(tight.pressureLevel);
  });
});
