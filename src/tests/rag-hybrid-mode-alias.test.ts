/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-17.T05 — MCP_GRAPH_EMBEDDINGS env toggle (alias for RAG_HYBRID_MODE).
 */

import { describe, it, expect } from "vitest";
import { parseRagHybridMode } from "../core/rag/rag-hybrid-mode.js";

describe("MCP_GRAPH_EMBEDDINGS env toggle (§EPIC-17.T05)", () => {
  it("MCP_GRAPH_EMBEDDINGS=tfidf maps to lexical (default current behavior)", () => {
    expect(parseRagHybridMode({ MCP_GRAPH_EMBEDDINGS: "tfidf" })).toBe("lexical");
  });

  it("MCP_GRAPH_EMBEDDINGS=onnx maps to hybrid (BM25 + ONNX semantic)", () => {
    expect(parseRagHybridMode({ MCP_GRAPH_EMBEDDINGS: "onnx" })).toBe("hybrid");
  });

  it("MCP_GRAPH_EMBEDDINGS=semantic passes through", () => {
    expect(parseRagHybridMode({ MCP_GRAPH_EMBEDDINGS: "semantic" })).toBe("semantic");
  });

  it("MCP_GRAPH_EMBEDDINGS=hybrid passes through", () => {
    expect(parseRagHybridMode({ MCP_GRAPH_EMBEDDINGS: "hybrid" })).toBe("hybrid");
  });

  it("RAG_HYBRID_MODE takes precedence when both set (canonical wins)", () => {
    expect(
      parseRagHybridMode({ RAG_HYBRID_MODE: "lexical", MCP_GRAPH_EMBEDDINGS: "onnx" }),
    ).toBe("lexical");
  });

  it("default (neither set) is lexical — graceful fallback preserved", () => {
    expect(parseRagHybridMode({})).toBe("lexical");
  });

  it("invalid MCP_GRAPH_EMBEDDINGS value throws clearly", () => {
    expect(() => parseRagHybridMode({ MCP_GRAPH_EMBEDDINGS: "garbage" })).toThrow(/MCP_GRAPH_EMBEDDINGS/);
  });
});
