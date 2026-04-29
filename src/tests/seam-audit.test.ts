/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-9.T05 — seam audit tests.
 */

import { describe, it, expect } from "vitest";
import {
  classifySpecifier,
  extractImportSpecifiers,
  auditFile,
} from "../core/analyzer/seam-audit.js";

describe("seam-audit (E9.T05)", () => {
  it("classifies in-process: relative imports", () => {
    expect(classifySpecifier("./foo.js").category).toBe("in-process");
    expect(classifySpecifier("../bar.js").category).toBe("in-process");
  });

  it("classifies local-substitutable: better-sqlite3, fs, node:* core modules", () => {
    expect(classifySpecifier("better-sqlite3").category).toBe("local-substitutable");
    expect(classifySpecifier("node:fs").category).toBe("local-substitutable");
    expect(classifySpecifier("fs/promises").category).toBe("local-substitutable");
    expect(classifySpecifier("node:path").category).toBe("local-substitutable");
  });

  it("classifies true-external: SDK packages", () => {
    expect(classifySpecifier("@anthropic-ai/sdk").category).toBe("true-external");
    expect(classifySpecifier("openai").category).toBe("true-external");
    expect(classifySpecifier("@aws-sdk/client-s3").category).toBe("true-external");
  });

  it("classifies remote-owned: HTTP clients, MCP, gRPC", () => {
    expect(classifySpecifier("axios").category).toBe("remote-owned");
    expect(classifySpecifier("@modelcontextprotocol/sdk").category).toBe("remote-owned");
    expect(classifySpecifier("undici").category).toBe("remote-owned");
  });

  it("classifies unknown packages as remote-owned (heuristic fallback)", () => {
    const r = classifySpecifier("some-random-package");
    expect(r.category).toBe("remote-owned");
    expect(r.suggestion).toContain("heuristic");
  });

  it("suggestion contains category-specific guidance", () => {
    expect(classifySpecifier("./local.js").suggestion).toContain("merging");
    expect(classifySpecifier("better-sqlite3").suggestion).toContain("stand-in");
    expect(classifySpecifier("openai").suggestion).toContain("adapter");
    expect(classifySpecifier("axios").suggestion).toContain("timeout");
  });

  it("extractImportSpecifiers picks up import + export-from + named imports", () => {
    const code = [
      `import { x } from "./a.js";`,
      `import * as fs from "node:fs";`,
      `import OpenAI from "openai";`,
      `export { y } from "./b.js";`,
      `// import { z } from "ignored";`,
      `const not = "import 'oops'";`,
    ].join("\n");
    const specs = extractImportSpecifiers(code);
    expect(specs).toEqual(["./a.js", "node:fs", "openai", "./b.js"]);
  });

  it("auditFile groups by category and counts each", () => {
    const code = [
      `import a from "./a.js";`,
      `import b from "./b.js";`,
      `import sqlite from "better-sqlite3";`,
      `import OpenAI from "openai";`,
      `import axios from "axios";`,
    ].join("\n");
    const r = auditFile("file.ts", code);
    expect(r.summary["in-process"]).toBe(2);
    expect(r.summary["local-substitutable"]).toBe(1);
    expect(r.summary["true-external"]).toBe(1);
    expect(r.summary["remote-owned"]).toBe(1);
    expect(r.imports).toHaveLength(5);
  });

  it("auditFile returns empty summary for file with no imports", () => {
    const r = auditFile("empty.ts", "export const x = 1;");
    expect(r.imports).toEqual([]);
    expect(r.summary["in-process"]).toBe(0);
    expect(r.summary["true-external"]).toBe(0);
  });
});
