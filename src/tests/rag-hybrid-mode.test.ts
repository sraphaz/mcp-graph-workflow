/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  parseRagHybridMode,
  type RagMode,
} from "../core/rag/rag-hybrid-mode.js";

describe("parseRagHybridMode — env-var parsing", () => {
  it("returns 'lexical' when env var is not set", () => {
    expect(parseRagHybridMode({})).toBe("lexical");
  });

  it("returns 'lexical' when RAG_HYBRID_MODE=lexical", () => {
    expect(parseRagHybridMode({ RAG_HYBRID_MODE: "lexical" })).toBe("lexical");
  });

  it("returns 'hybrid' when RAG_HYBRID_MODE=hybrid", () => {
    expect(parseRagHybridMode({ RAG_HYBRID_MODE: "hybrid" })).toBe("hybrid");
  });

  it("returns 'semantic' when RAG_HYBRID_MODE=semantic", () => {
    expect(parseRagHybridMode({ RAG_HYBRID_MODE: "semantic" })).toBe("semantic");
  });

  it("throws on invalid value", () => {
    expect(() => parseRagHybridMode({ RAG_HYBRID_MODE: "fuzzy" })).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => parseRagHybridMode({ RAG_HYBRID_MODE: "" })).toThrow();
  });

  it("throws on numeric-like value", () => {
    expect(() => parseRagHybridMode({ RAG_HYBRID_MODE: "1" })).toThrow();
  });
});

describe("parseRagHybridMode — type safety", () => {
  it("returned value is one of the valid RagMode literals", () => {
    const validModes: RagMode[] = ["lexical", "hybrid", "semantic"];
    const result = parseRagHybridMode({ RAG_HYBRID_MODE: "hybrid" });
    expect(validModes).toContain(result);
  });
});

describe("parseRagHybridMode — default mode preserves lexical", () => {
  it("default is 'lexical' — no env var means no change to BM25 behavior", () => {
    const mode = parseRagHybridMode({});
    expect(mode).toBe("lexical");
    // lexical mode should never activate ONNX
    expect(mode === "hybrid" || mode === "semantic").toBe(false);
  });
});
