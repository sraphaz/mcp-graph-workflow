/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-8.T04 — ubiquitous-language tests.
 */

import { describe, it, expect } from "vitest";
import {
  parseVocab,
  mergeVocab,
  renderVocabSection,
  upsertVocabSection,
  VOCAB_HEADER,
} from "../core/knowledge/ubiquitous-language.js";

describe("ubiquitous-language (E8.T04)", () => {
  it("VOCAB_HEADER is '## Vocabulário Canonical'", () => {
    expect(VOCAB_HEADER).toBe("## Vocabulário Canonical");
  });

  describe("parseVocab", () => {
    it("returns [] when section absent", () => {
      expect(parseVocab("# Title\n\nNothing here.")).toEqual([]);
    });

    it("parses term blocks with definition", () => {
      const doc = `${VOCAB_HEADER}\n\n### Module\n\nA cohesive set of code.\n\n### Seam\n\nA boundary where behavior can swap.`;
      const terms = parseVocab(doc);
      expect(terms).toHaveLength(2);
      expect(terms[0]).toEqual({ term: "Module", definition: "A cohesive set of code." });
      expect(terms[1].term).toBe("Seam");
    });

    it("captures Avoid line per term", () => {
      const doc = `${VOCAB_HEADER}\n\n### Adapter\n\nGlue between layers.\n\n**Avoid:** wrapping core types.`;
      const [t] = parseVocab(doc);
      expect(t.avoid).toBe("wrapping core types.");
    });

    it("stops at next H2 boundary", () => {
      const doc = `${VOCAB_HEADER}\n\n### Module\n\nDef.\n\n## Other Section\n\n### NotATerm\n\nIgnored.`;
      const terms = parseVocab(doc);
      expect(terms.map((t) => t.term)).toEqual(["Module"]);
    });
  });

  describe("mergeVocab", () => {
    it("adds new terms to existing list", () => {
      const merged = mergeVocab(
        [{ term: "Module", definition: "A" }],
        [{ term: "Seam", definition: "B" }],
      );
      expect(merged.map((t) => t.term).sort()).toEqual(["Module", "Seam"]);
    });

    it("does NOT duplicate when same term with same definition", () => {
      const merged = mergeVocab(
        [{ term: "Module", definition: "Same" }],
        [{ term: "Module", definition: "Same" }],
      );
      expect(merged).toHaveLength(1);
    });

    it("throws on conflict (different non-empty definitions)", () => {
      expect(() =>
        mergeVocab(
          [{ term: "Module", definition: "First" }],
          [{ term: "Module", definition: "Second" }],
        ),
      ).toThrow(/conflict/);
    });

    it("fills missing avoid from incoming", () => {
      const merged = mergeVocab(
        [{ term: "Adapter", definition: "Glue" }],
        [{ term: "Adapter", definition: "Glue", avoid: "wrapping core" }],
      );
      expect(merged[0].avoid).toBe("wrapping core");
    });

    it("treats term match as case-insensitive", () => {
      expect(() =>
        mergeVocab(
          [{ term: "Module", definition: "First" }],
          [{ term: "module", definition: "Second" }],
        ),
      ).toThrow(/conflict/);
    });
  });

  describe("renderVocabSection", () => {
    it("renders sorted blocks with header", () => {
      const md = renderVocabSection([
        { term: "Seam", definition: "boundary" },
        { term: "Adapter", definition: "glue", avoid: "wrap core" },
      ]);
      expect(md).toContain(VOCAB_HEADER);
      const adapterIdx = md.indexOf("### Adapter");
      const seamIdx = md.indexOf("### Seam");
      expect(adapterIdx).toBeGreaterThan(-1);
      expect(adapterIdx).toBeLessThan(seamIdx);
      expect(md).toContain("**Avoid:** wrap core");
    });

    it("renders empty marker when no terms", () => {
      expect(renderVocabSection([])).toContain("_(empty)_");
    });
  });

  describe("upsertVocabSection", () => {
    it("appends section when absent", () => {
      const result = upsertVocabSection("# CONTEXT\n", `${VOCAB_HEADER}\n\n### M\n\nDef.\n`);
      expect(result).toContain("# CONTEXT");
      expect(result).toContain(VOCAB_HEADER);
    });

    it("replaces existing section preserving following sections", () => {
      const original = `# CONTEXT\n\n${VOCAB_HEADER}\n\n### Old\n\nOld def.\n\n## Conventions\n\nrules`;
      const updated = upsertVocabSection(original, `${VOCAB_HEADER}\n\n### New\n\nNew def.\n`);
      expect(updated).toContain("### New");
      expect(updated).not.toContain("### Old");
      expect(updated).toContain("## Conventions");
    });
  });
});
