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
  hashNodeCanonical,
  canonicalSerialize,
} from "../../core/provenance/canonical-hasher.js";

describe("hashNodeCanonical", () => {
  describe("AC1: key order invariance — same semantic node produces same hash", () => {
    it("returns the same hash regardless of top-level key order", () => {
      const a = { id: "n1", title: "hello", priority: 1 };
      const b = { priority: 1, title: "hello", id: "n1" };
      const c = { title: "hello", id: "n1", priority: 1 };

      const hashA = hashNodeCanonical(a);
      const hashB = hashNodeCanonical(b);
      const hashC = hashNodeCanonical(c);

      expect(hashA).toBe(hashB);
      expect(hashB).toBe(hashC);
    });

    it("returns the same hash regardless of nested key order", () => {
      const a = { id: "n1", meta: { author: "d", version: 2 } };
      const b = { meta: { version: 2, author: "d" }, id: "n1" };

      expect(hashNodeCanonical(a)).toBe(hashNodeCanonical(b));
    });

    it("normalizes leading/trailing whitespace in string values", () => {
      const a = { title: "hello" };
      const b = { title: "  hello  " };

      expect(hashNodeCanonical(a)).toBe(hashNodeCanonical(b));
    });

    it("returns a stable 64-char hex digest", () => {
      const hash = hashNodeCanonical({ id: "n1" });

      expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    });
  });

  describe("AC2: minimal semantic change → hash diverges", () => {
    it("changes the hash when a single character in a value flips", () => {
      const a = { id: "n1", title: "Hello" };
      const b = { id: "n1", title: "Hellp" };

      expect(hashNodeCanonical(a)).not.toBe(hashNodeCanonical(b));
    });

    it("changes the hash when a key is added", () => {
      const a = { id: "n1" };
      const b = { id: "n1", extra: "x" };

      expect(hashNodeCanonical(a)).not.toBe(hashNodeCanonical(b));
    });

    it("changes the hash when a key is removed", () => {
      const a = { id: "n1", status: "done" };
      const b = { id: "n1" };

      expect(hashNodeCanonical(a)).not.toBe(hashNodeCanonical(b));
    });

    it("distinguishes number from numeric string", () => {
      const a = { priority: 1 };
      const b = { priority: "1" };

      expect(hashNodeCanonical(a)).not.toBe(hashNodeCanonical(b));
    });

    it("distinguishes arrays with different element order", () => {
      const a = { tags: ["a", "b"] };
      const b = { tags: ["b", "a"] };

      expect(hashNodeCanonical(a)).not.toBe(hashNodeCanonical(b));
    });
  });

  describe("AC3: batch performance — 1000 nodes in under 500ms", () => {
    it("hashes 1000 distinct nodes in under 500ms", () => {
      const nodes = Array.from({ length: 1000 }, (_, i) => ({
        id: `n${i}`,
        title: `node-${i}`,
        priority: (i % 5) + 1,
        tags: [`tag-${i % 10}`, `tag-${i % 7}`],
        meta: { createdAt: `2026-04-19T22:00:00.${i.toString().padStart(3, "0")}Z`, author: "bench" },
      }));

      const start = performance.now();
      for (const node of nodes) {
        hashNodeCanonical(node);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });
  });

  describe("canonicalSerialize (exposed for auditability)", () => {
    it("produces sorted-key JSON without whitespace between tokens", () => {
      const serialized = canonicalSerialize({ b: 1, a: 2 });

      expect(serialized).toBe('{"a":2,"b":1}');
    });

    it("handles null, booleans, numbers, strings consistently", () => {
      const serialized = canonicalSerialize({
        s: "x",
        n: 42,
        b: true,
        z: null,
      });

      expect(serialized).toBe('{"b":true,"n":42,"s":"x","z":null}');
    });

    it("preserves array element order (arrays are ordered by definition)", () => {
      const serialized = canonicalSerialize({ tags: ["x", "y", "z"] });

      expect(serialized).toBe('{"tags":["x","y","z"]}');
    });
  });
});
