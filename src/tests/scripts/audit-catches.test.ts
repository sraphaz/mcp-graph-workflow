/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Story 8 subtask: audit:catches script
 *
 * AC1: catch (e) {} → finding with file + line
 * AC2: no empty catches → empty array
 * AC3: catch with real code → not reported
 * AC4: package.json has audit:catches script
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { findEmptyCatches, collectTsFiles } from "../../../scripts/audit-catches.js";

// ── AC1: empty catch detected ─────────────────────────────────────────────────

describe("findEmptyCatches — AC1: detects empty catch blocks", () => {
  it("AC1: detects same-line empty catch `catch (e) {}`", () => {
    const src = 'try { foo(); } catch (e) {}';
    const findings = findEmptyCatches(src, "test.ts");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.file).toBe("test.ts");
    expect(findings[0]!.line).toBeGreaterThanOrEqual(1);
  });

  it("AC1: detects catch with comment-only body `catch (e) { /* ignore */ }`", () => {
    const src = 'try { foo(); } catch (e) { /* ignore */ }';
    const findings = findEmptyCatches(src, "f.ts");
    expect(findings.length).toBeGreaterThan(0);
  });

  it("AC1: detects no-binding empty catch `catch {}`", () => {
    const src = 'try { foo(); } catch {}';
    const findings = findEmptyCatches(src, "f.ts");
    expect(findings.length).toBeGreaterThan(0);
  });

  it("AC1: reports line number correctly (1-based)", () => {
    const src = "const x = 1;\ntry { foo(); } catch (err) {}\nconst y = 2;";
    const findings = findEmptyCatches(src, "f.ts");
    expect(findings[0]!.line).toBe(2);
  });
});

// ── AC2: clean source returns empty array ─────────────────────────────────────

describe("findEmptyCatches — AC2: no findings on clean source", () => {
  it("AC2: returns empty array when no catches exist", () => {
    const src = "const x = 1; function foo() { return x; }";
    expect(findEmptyCatches(src, "f.ts")).toEqual([]);
  });

  it("AC2: returns empty array when all catches have real code", () => {
    const src = `try {
  doThing();
} catch (e) {
  logger.error("error", { e });
}`;
    expect(findEmptyCatches(src, "f.ts")).toEqual([]);
  });
});

// ── AC3: catch with real code not reported ────────────────────────────────────

describe("findEmptyCatches — AC3: catch with real code not flagged", () => {
  it("AC3: catch with a single statement not flagged", () => {
    const src = 'try { x(); } catch (e) { console.error(e); }';
    expect(findEmptyCatches(src, "f.ts")).toEqual([]);
  });

  it("AC3: catch that re-throws not flagged", () => {
    const src = 'try { x(); } catch (e) { throw e; }';
    expect(findEmptyCatches(src, "f.ts")).toEqual([]);
  });
});

// ── AC4: package.json has audit:catches ──────────────────────────────────────

describe("audit:catches — AC4: npm script registered", () => {
  it("AC4: package.json scripts.audit:catches is defined", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["audit:catches"]).toBeDefined();
    expect(pkg.scripts?.["audit:catches"]).toContain("audit-catches");
  });
});

// ── AC5: src/core has no empty catch blocks after remediation ─────────────────

describe("audit:catches — AC5: src/core remediated", () => {
  it("AC5: src/core has zero empty-catch findings", () => {
    const coreRoot = join(process.cwd(), "src/core");
    // best-practices.ts is excluded: the regex matches a data-literal string that
    // demonstrates an incorrect pattern — it is not a real catch block.
    const files = collectTsFiles(coreRoot).filter(
      (f: string) => !f.endsWith("best-practices.ts")
    );
    const allFindings: Array<{ file: string; line: number; snippet: string }> = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      allFindings.push(...findEmptyCatches(content, file));
    }
    if (allFindings.length > 0) {
      const msg = allFindings
        .map((f: { file: string; line: number; snippet: string }) => `  ${f.file}:${f.line}  ${f.snippet}`)
        .join("\n");
      expect.fail(`Empty catches found in src/core:\n${msg}`);
    }
    expect(allFindings).toHaveLength(0);
  });
});
