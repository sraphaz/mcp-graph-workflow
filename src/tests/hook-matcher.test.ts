/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §HOOKS-INTEGRATION 5.2 — matcher grammar tests.
 */

import { describe, it, expect } from "vitest";
import {
  parseMatcher,
  matches,
  globMatch,
} from "../core/hooks/matcher.js";

describe("hook-matcher (HOOKS 5.2)", () => {
  describe("parseMatcher", () => {
    it("parses bare channel (no filters)", () => {
      expect(parseMatcher("task:post-complete")).toEqual({
        channel: "task:post-complete",
        filters: [],
      });
    });

    it("parses single equality filter", () => {
      expect(parseMatcher("tool:pre-call(toolName:Bash)")).toEqual({
        channel: "tool:pre-call",
        filters: [{ key: "toolName", kind: "glob", pattern: "Bash" }],
      });
    });

    it("parses numeric comparator filter", () => {
      expect(parseMatcher("tool:post-call(durationMs:>1000)")).toEqual({
        channel: "tool:post-call",
        filters: [{ key: "durationMs", kind: "numeric", comparator: ">", threshold: 1000 }],
      });
    });

    it("parses multiple comma-separated filters", () => {
      const ast = parseMatcher("tool:pre-call(toolName:Bash,command:npm run *)");
      expect(ast.channel).toBe("tool:pre-call");
      expect(ast.filters).toHaveLength(2);
      expect(ast.filters[1].pattern).toBe("npm run *");
    });

    it("treats (*) as match-all (no filters)", () => {
      expect(parseMatcher("task:error(*)")).toEqual({ channel: "task:error", filters: [] });
    });

    it("rejects malformed input", () => {
      expect(() => parseMatcher("")).toThrow();
      expect(() => parseMatcher("missing-paren(toolName:Bash")).toThrow();
      expect(() => parseMatcher("(no-channel)")).toThrow();
      expect(() => parseMatcher("ch(novalue)")).toThrow();
    });
  });

  describe("globMatch", () => {
    it("'*' matches anything", () => {
      expect(globMatch("*", "anything")).toBe(true);
    });
    it("exact string match", () => {
      expect(globMatch("Bash", "Bash")).toBe(true);
      expect(globMatch("Bash", "bash")).toBe(false);
    });
    it("prefix glob", () => {
      expect(globMatch("npm run *", "npm run build")).toBe(true);
      expect(globMatch("npm run *", "yarn run build")).toBe(false);
    });
    it("escapes regex metacharacters in pattern (treats them as literal)", () => {
      expect(globMatch("foo.bar", "foo.bar")).toBe(true);
      expect(globMatch("foo.bar", "fooXbar")).toBe(false);
    });
  });

  describe("matches (AST + event)", () => {
    it("matches bare channel against any payload", () => {
      const ast = parseMatcher("task:post-complete");
      expect(matches(ast, { channel: "task:post-complete", payload: { x: 1 } })).toBe(true);
      expect(matches(ast, { channel: "task:error" })).toBe(false);
    });

    it("matches glob filter against payload key", () => {
      const ast = parseMatcher("tool:pre-call(toolName:Bash)");
      expect(matches(ast, { channel: "tool:pre-call", payload: { toolName: "Bash" } })).toBe(true);
      expect(matches(ast, { channel: "tool:pre-call", payload: { toolName: "Read" } })).toBe(false);
    });

    it("matches numeric > comparator", () => {
      const ast = parseMatcher("tool:post-call(durationMs:>1000)");
      expect(matches(ast, { channel: "tool:post-call", payload: { durationMs: 2500 } })).toBe(true);
      expect(matches(ast, { channel: "tool:post-call", payload: { durationMs: 500 } })).toBe(false);
    });

    it("AND-combines multiple filters", () => {
      const ast = parseMatcher("tool:pre-call(toolName:Bash,command:npm run *)");
      expect(matches(ast, {
        channel: "tool:pre-call",
        payload: { toolName: "Bash", command: "npm run build" },
      })).toBe(true);
      expect(matches(ast, {
        channel: "tool:pre-call",
        payload: { toolName: "Bash", command: "git status" },
      })).toBe(false);
    });

    it("missing payload key fails the filter", () => {
      const ast = parseMatcher("tool:pre-call(toolName:Bash)");
      expect(matches(ast, { channel: "tool:pre-call", payload: {} })).toBe(false);
    });
  });
});
