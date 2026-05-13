/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, afterAll } from "vitest";
import AdmZip from "adm-zip";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectLanguageByExtension,
  extractZip,
} from "../core/translation/zip-extractor.js";

const createdDirs: string[] = [];
afterAll(() => {
  for (const d of createdDirs) rmSync(d, { recursive: true, force: true });
});

function buildZip(entries: Record<string, Buffer | string>): string {
  const zip = new AdmZip();
  for (const [name, body] of Object.entries(entries)) {
    const buf = typeof body === "string" ? Buffer.from(body, "utf-8") : body;
    zip.addFile(name, buf);
  }
  const dir = mkdtempSync(join(tmpdir(), "zip-extractor-")); createdDirs.push(dir);
  const path = join(dir, "fixture.zip");
  writeFileSync(path, zip.toBuffer());
  return path;
}

describe("detectLanguageByExtension", () => {
  it("maps common TypeScript and JavaScript extensions", () => {
    expect(detectLanguageByExtension(".ts")).toBe("typescript");
    expect(detectLanguageByExtension(".tsx")).toBe("typescript");
    expect(detectLanguageByExtension(".js")).toBe("javascript");
    expect(detectLanguageByExtension(".jsx")).toBe("javascript");
  });

  it("maps systems languages", () => {
    expect(detectLanguageByExtension(".go")).toBe("go");
    expect(detectLanguageByExtension(".rs")).toBe("rust");
    expect(detectLanguageByExtension(".cpp")).toBe("cpp");
    expect(detectLanguageByExtension(".h")).toBe("cpp");
  });

  it("normalizes case", () => {
    expect(detectLanguageByExtension(".TS")).toBe("typescript");
    expect(detectLanguageByExtension(".Py")).toBe("python");
  });

  it("returns undefined for unknown extensions", () => {
    expect(detectLanguageByExtension(".weird")).toBeUndefined();
    expect(detectLanguageByExtension("")).toBeUndefined();
  });
});

describe("extractZip", () => {
  it("extracts UTF-8 source files with detected language and size", () => {
    const zipPath = buildZip({
      "src/foo.ts": "export const x = 1;\n",
      "src/bar.py": "def y(): pass\n",
    });
    const files = extractZip(zipPath);
    expect(files).toHaveLength(2);

    const foo = files.find((f) => f.relativePath === "src/foo.ts");
    expect(foo?.detectedLanguage).toBe("typescript");
    expect(foo?.content).toBe("export const x = 1;\n");
    expect(foo?.sizeBytes).toBe(Buffer.byteLength("export const x = 1;\n", "utf-8"));

    const bar = files.find((f) => f.relativePath === "src/bar.py");
    expect(bar?.detectedLanguage).toBe("python");
  });

  it("filters node_modules, .git, dist, build, __pycache__ and friends", () => {
    const zipPath = buildZip({
      "src/keeper.ts": "ok",
      "node_modules/lib/index.js": "ignored",
      ".git/HEAD": "ignored",
      "dist/output.js": "ignored",
      "build/main.js": "ignored",
      "__pycache__/x.pyc": "ignored",
      ".vscode/settings.json": "ignored",
      "__MACOSX/foo": "ignored",
    });
    const files = extractZip(zipPath);
    expect(files.map((f) => f.relativePath)).toEqual(["src/keeper.ts"]);
  });

  it("skips hidden dotfiles at any path level", () => {
    const zipPath = buildZip({
      "src/visible.ts": "ok",
      ".env": "secret",
      "src/.hidden.ts": "secret",
    });
    const files = extractZip(zipPath);
    expect(files.map((f) => f.relativePath)).toEqual(["src/visible.ts"]);
  });

  it("skips binary files by extension (e.g. .png, .exe, .jar)", () => {
    const zipPath = buildZip({
      "src/code.ts": "ok",
      "assets/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      "lib/native.so": Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
      "vendor.jar": Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    });
    const files = extractZip(zipPath);
    expect(files.map((f) => f.relativePath)).toEqual(["src/code.ts"]);
  });

  it("skips files containing null bytes (binary heuristic)", () => {
    const zipPath = buildZip({
      "src/text.ts": "fine\n",
      "src/binary.dat": Buffer.from([0x68, 0x69, 0x00, 0x77, 0x6f]), // "hi\0wo"
    });
    const files = extractZip(zipPath);
    expect(files.map((f) => f.relativePath)).toEqual(["src/text.ts"]);
  });

  it("skips files exceeding 500 KB", () => {
    // Build a >500KB string. Pad with an ASCII char so isBinaryFile won't
    // flag it via null-byte heuristic — the size guard must trip first.
    const big = "a".repeat(600 * 1024);
    const zipPath = buildZip({
      "src/big.ts": big,
      "src/small.ts": "ok",
    });
    const files = extractZip(zipPath);
    expect(files.map((f) => f.relativePath)).toEqual(["src/small.ts"]);
  });

  it("returns empty array on a corrupted/non-zip file", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-extractor-")); createdDirs.push(dir);
    const path = join(dir, "garbage.zip");
    writeFileSync(path, "this is not a zip file");
    expect(extractZip(path)).toEqual([]);
  });

  it("returns empty array when the zip is empty", () => {
    const zipPath = buildZip({});
    expect(extractZip(zipPath)).toEqual([]);
  });

  it("preserves the relativePath of nested directories", () => {
    const zipPath = buildZip({
      "deep/nested/folder/file.ts": "ok",
    });
    const files = extractZip(zipPath);
    expect(files[0]?.relativePath).toBe("deep/nested/folder/file.ts");
  });

  it("omits detectedLanguage when extension is unrecognized but file is text", () => {
    const zipPath = buildZip({
      "README.unknown": "plain text",
    });
    const files = extractZip(zipPath);
    expect(files).toHaveLength(1);
    expect(files[0].detectedLanguage).toBeUndefined();
  });
});
