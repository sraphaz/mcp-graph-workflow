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
  compressText,

} from "../core/context/compress-text.js";

describe("compressText", () => {
  const sampleText = [
    "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
    "It adds optional static typing and class-based OOP to the language.",
    "Docker simplifies deployment by containerizing applications.",
    "Containers share the host OS kernel, making them lightweight.",
    "PostgreSQL is an advanced open-source relational database system.",
  ].join(" ");

  describe("bullets format", () => {
    it("should return bullet-formatted output", () => {
      const result = compressText(sampleText, "bullets", 2000);

      expect(result.compressed).toContain("- ");
      expect(result.stats.format).toBe("bullets");
      expect(result.stats.input_tokens).toBeGreaterThan(0);
      expect(result.stats.output_tokens).toBeGreaterThan(0);
    });
  });

  describe("summary format", () => {
    it("should return topic sentences", () => {
      const multiParagraph = [
        "TypeScript adds static typing to JavaScript. It improves developer experience.",
        "",
        "Docker containerizes applications for deployment. It simplifies infrastructure.",
      ].join("\n");

      const result = compressText(multiParagraph, "summary", 2000);

      expect(result.stats.format).toBe("summary");
      expect(result.stats.input_tokens).toBeGreaterThan(0);
    });
  });

  describe("steps format", () => {
    it("should extract numbered steps", () => {
      const stepsText = "Introduction text.\n1. Install Node.js\n2. Run npm install\n3. Configure environment\n4. Start the server";

      const result = compressText(stepsText, "steps", 2000);

      expect(result.compressed).toContain("1. Install Node.js");
      expect(result.compressed).toContain("2. Run npm install");
      expect(result.stats.format).toBe("steps");
    });
  });

  describe("json format", () => {
    it("should return valid JSON with headers as keys", () => {
      const mdText = "## Installation\nRun npm install.\n## Usage\nRun npm start.";

      const result = compressText(mdText, "json", 2000);

      expect(() => JSON.parse(result.compressed)).not.toThrow();
      const parsed = JSON.parse(result.compressed);
      expect(parsed).toHaveProperty("Installation");
      expect(result.stats.format).toBe("json");
    });

    it("should return fallback points array for unstructured text", () => {
      const result = compressText(sampleText, "json", 2000);

      expect(() => JSON.parse(result.compressed)).not.toThrow();
      const parsed = JSON.parse(result.compressed);
      expect(parsed).toHaveProperty("points");
      expect(parsed).toHaveProperty("total_sentences");
    });
  });

  describe("stats", () => {
    it("should include all required stats fields", () => {
      const result = compressText(sampleText, "bullets", 2000);

      expect(result.stats).toHaveProperty("input_tokens");
      expect(result.stats).toHaveProperty("output_tokens");
      expect(result.stats).toHaveProperty("reduction_percent");
      expect(result.stats).toHaveProperty("format");
      expect(typeof result.stats.input_tokens).toBe("number");
      expect(typeof result.stats.output_tokens).toBe("number");
      expect(typeof result.stats.reduction_percent).toBe("number");
    });

    it("should calculate reduction_percent correctly", () => {
      const result = compressText(sampleText, "bullets", 2000);

      const expected = Math.round(
        (1 - result.stats.output_tokens / result.stats.input_tokens) * 100,
      );
      expect(result.stats.reduction_percent).toBe(expected);
    });
  });

  describe("empty input", () => {
    it("should handle empty text", () => {
      const result = compressText("", "bullets", 2000);

      expect(result.compressed).toBe("");
      expect(result.stats.input_tokens).toBe(0);
      expect(result.stats.output_tokens).toBe(0);
      expect(result.stats.reduction_percent).toBe(0);
    });
  });
});
