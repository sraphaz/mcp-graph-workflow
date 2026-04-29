/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C6 — memory gap detector tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  extractKeyTerms,
  detectKnowledgeGaps,
  TOP_K_TERMS,
} from "../core/rag/memory-gap-detector.js";

describe("memory-gap-detector (E22.C6)", () => {
  it("TOP_K_TERMS = 10", () => {
    expect(TOP_K_TERMS).toBe(10);
  });

  it("extractKeyTerms returns [] on empty input", () => {
    expect(extractKeyTerms("")).toEqual([]);
  });

  it("extractKeyTerms picks CamelCase identifiers", () => {
    const terms = extractKeyTerms(
      "The XYZService integrates with PaymentGateway and OrderProcessor.",
    );
    expect(terms).toContain("XYZService");
    expect(terms).toContain("PaymentGateway");
    expect(terms).toContain("OrderProcessor");
  });

  it("extractKeyTerms picks ALL_CAPS constants", () => {
    const terms = extractKeyTerms("Use MAX_RETRY_ATTEMPTS and DEFAULT_TIMEOUT here.");
    expect(terms).toContain("MAX_RETRY_ATTEMPTS");
    expect(terms).toContain("DEFAULT_TIMEOUT");
  });

  it("extractKeyTerms falls back to frequency tokens when proper nouns scarce", () => {
    const text = "auth flow auth handler auth middleware auth helper";
    const terms = extractKeyTerms(text);
    expect(terms).toContain("auth");
  });

  it("extractKeyTerms drops stopwords and short tokens", () => {
    const terms = extractKeyTerms("the is a of to in and or");
    expect(terms).toEqual([]);
  });

  it("extractKeyTerms caps at topK", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Service${i}`).join(" ");
    expect(extractKeyTerms(text, 5)).toHaveLength(5);
  });

  describe("detectKnowledgeGaps", () => {
    let db: Database.Database;

    beforeEach(() => {
      db = new Database(":memory:");
      db.exec(`
        CREATE TABLE knowledge_documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL
        );
        INSERT INTO knowledge_documents (id, title, content) VALUES
          ('doc1', 'Auth Guide', 'OAuth flow with PKCE'),
          ('doc2', 'Retry Spec', 'Exponential backoff strategy');
      `);
    });

    afterEach(() => {
      db.close();
    });

    it("flags terms with 0 hits as undocumented", () => {
      const result = detectKnowledgeGaps(db, ["XYZService", "OAuth"]);
      const xyz = result.find((r) => r.term === "XYZService");
      const oauth = result.find((r) => r.term === "OAuth");
      expect(xyz?.undocumented).toBe(true);
      expect(xyz?.hits).toBe(0);
      expect(oauth?.undocumented).toBe(false);
      expect(oauth?.hits).toBeGreaterThan(0);
    });

    it("returns all undocumented when knowledge_documents table missing", () => {
      const empty = new Database(":memory:");
      const result = detectKnowledgeGaps(empty, ["FooBar", "Baz"]);
      expect(result.every((r) => r.undocumented)).toBe(true);
      empty.close();
    });

    it("matches by title as well as content", () => {
      const result = detectKnowledgeGaps(db, ["Auth Guide"]);
      expect(result[0].undocumented).toBe(false);
    });

    it("scenario: PRD with XYZService → flagged undocumented", () => {
      const prd = "Implement XYZService for the new module.";
      const terms = extractKeyTerms(prd);
      expect(terms).toContain("XYZService");
      const gaps = detectKnowledgeGaps(db, terms).filter((r) => r.undocumented);
      expect(gaps.some((g) => g.term === "XYZService")).toBe(true);
    });
  });
});
