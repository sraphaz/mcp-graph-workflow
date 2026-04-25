/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendHistory,
  compactHistory,
  historyPath,
  loadHistory,
} from "./persistent-history.js";

describe("persistent REPL history (Sprint 7 #7.12)", () => {
  let tmp: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-history-"));
    prevHome = process.env.HOME;
    process.env.HOME = tmp;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns [] when the file does not exist", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("appends entries and reads them back in chronological order", () => {
    appendHistory("/init");
    appendHistory("/next");
    appendHistory("/help");
    const entries = loadHistory();
    expect(entries).toEqual(["/init", "/next", "/help"]);
  });

  it("dedupes when the new entry equals the last-appended marker", () => {
    appendHistory("/help");
    appendHistory("/help", "/help"); // marked dup → skipped
    appendHistory("/init", "/help");
    const entries = loadHistory();
    expect(entries).toEqual(["/help", "/init"]);
  });

  it("ignores empty/whitespace entries", () => {
    appendHistory("");
    appendHistory("   \t  ");
    appendHistory("/init");
    expect(loadHistory()).toEqual(["/init"]);
  });

  it("creates the parent dir on first append if missing", () => {
    expect(existsSync(historyPath())).toBe(false);
    appendHistory("/init");
    expect(existsSync(historyPath())).toBe(true);
  });

  it("compactHistory truncates to the last 1000 entries when over cap", () => {
    // Seed the file with 1500 lines.
    mkdirSync(join(tmp, ".mcp-graph"), { recursive: true });
    const lines = Array.from({ length: 1500 }, (_, i) => `cmd-${i}`);
    writeFileSync(historyPath(), `${lines.join("\n")}\n`, "utf8");
    compactHistory();
    const after = readFileSync(historyPath(), "utf8")
      .split("\n")
      .filter((l) => l.length > 0);
    expect(after.length).toBe(1000);
    expect(after[0]).toBe("cmd-500"); // oldest 500 dropped
    expect(after[after.length - 1]).toBe("cmd-1499");
  });

  it("loadHistory caps at 1000 entries even when file is larger", () => {
    mkdirSync(join(tmp, ".mcp-graph"), { recursive: true });
    const lines = Array.from({ length: 1500 }, (_, i) => `cmd-${i}`);
    writeFileSync(historyPath(), `${lines.join("\n")}\n`, "utf8");
    const out = loadHistory();
    expect(out.length).toBe(1000);
    expect(out[0]).toBe("cmd-500");
  });
});
