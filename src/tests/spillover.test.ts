/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T02 — spillover tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  spillover,
  loadSpillover,
  isSpilloverPlaceholder,
  SPILLOVER_THRESHOLD_BYTES,
} from "../core/context/spillover.js";
import type { ChatMessage } from "../core/context/llm-summarizer.js";

describe("spillover (E7.T02)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "spillover-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("SPILLOVER_THRESHOLD_BYTES = 30 KB", () => {
    expect(SPILLOVER_THRESHOLD_BYTES).toBe(30 * 1024);
  });

  it("returns spilled=false for content <= threshold", () => {
    const msg: ChatMessage = { role: "tool-result", content: "small" };
    const r = spillover(msg, { sessionId: "s1", rootDir: dir });
    expect(r.spilled).toBe(false);
    expect(r.message).toBe(msg);
    expect(r.path).toBeUndefined();
  });

  it("writes file + returns placeholder when content > threshold", () => {
    const big = "x".repeat(40 * 1024); // 40 KB > 30 KB
    const msg: ChatMessage = { role: "tool-result", content: big };
    const r = spillover(msg, { sessionId: "s1", rootDir: dir, toolName: "search" });
    expect(r.spilled).toBe(true);
    expect(r.bytes).toBe(big.length);
    expect(r.path).toBeDefined();
    expect(existsSync(r.path!)).toBe(true);
    expect(r.message.content).toMatch(/^\[SPILLOVER\] path=.+ size=\d+$/);
    expect(r.message.role).toBe("tool-result");
  });

  it("creates session+tool nested directory structure", () => {
    const big = "y".repeat(40 * 1024);
    const msg: ChatMessage = { role: "tool-result", content: big };
    const r = spillover(msg, { sessionId: "abc", rootDir: dir, toolName: "rag" });
    expect(r.path).toContain(join(dir, "abc"));
    expect(r.path).toMatch(/rag-\d+/);
  });

  it("loadSpillover round-trips content", () => {
    const big = "round-trip-" + "z".repeat(40 * 1024);
    const msg: ChatMessage = { role: "tool-result", content: big };
    const r = spillover(msg, { sessionId: "s1", rootDir: dir });
    const loaded = loadSpillover(r.message.content);
    expect(loaded).toBe(big);
  });

  it("loadSpillover returns undefined for non-placeholder content", () => {
    expect(loadSpillover("regular content")).toBeUndefined();
    expect(loadSpillover("")).toBeUndefined();
  });

  it("loadSpillover returns undefined when target file is missing", () => {
    const fake = `[SPILLOVER] path=${join(dir, "nonexistent.json")} size=42`;
    expect(loadSpillover(fake)).toBeUndefined();
  });

  it("isSpilloverPlaceholder detects valid placeholder format", () => {
    expect(isSpilloverPlaceholder("[SPILLOVER] path=/tmp/x.json size=100")).toBe(true);
    expect(isSpilloverPlaceholder("regular text")).toBe(false);
    expect(isSpilloverPlaceholder("[SPILLOVER] path=")).toBe(false);
  });

  it("custom threshold honored", () => {
    const msg: ChatMessage = { role: "tool-result", content: "abcdef" };
    const r = spillover(msg, { sessionId: "s1", rootDir: dir, threshold: 3 });
    expect(r.spilled).toBe(true);
  });

  it("written file content matches original exactly", () => {
    const original = "α-β-γ\n" + "x".repeat(40 * 1024);
    const msg: ChatMessage = { role: "tool-result", content: original };
    const r = spillover(msg, { sessionId: "s1", rootDir: dir });
    expect(readFileSync(r.path!, "utf-8")).toBe(original);
  });
});
