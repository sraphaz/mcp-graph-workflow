/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Walker de vendor/
 *
 * AC1: GIVEN vendor/ com 4 projetos WHEN walk THEN retorna 4 entries
 * AC2: GIVEN __pycache__ ou .git WHEN walk THEN ignorados
 * AC3: GIVEN README.md ou SKILL.md no root do projeto WHEN walk THEN capturado em campo dedicado
 * AC4: GIVEN função WHEN testada THEN é pura (mesmo input → mesmo output)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { walkVendor } from "../../core/vendor-scan/walker.js";

function mkFixture(base: string, structure: Record<string, string>) {
  for (const [rel, content] of Object.entries(structure)) {
    const full = path.join(base, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}

describe("walkVendor — AC1: returns 4 projects", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-walk-"));
    mkFixture(tmpDir, {
      "proj-a/index.ts": "const x = 1;\nconst y = 2;\n",
      "proj-b/index.ts": "export {};\n",
      "proj-c/main.py": "print('hello')\n",
      "proj-d/config.json": '{"name":"d"}\n',
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return one entry per top-level project directory", () => {
    const tree = walkVendor(tmpDir);
    expect(tree.projects).toHaveLength(4);
    const names = tree.projects.map((p) => p.name).sort();
    expect(names).toEqual(["proj-a", "proj-b", "proj-c", "proj-d"]);
  });

  it("should include scannedAt ISO timestamp", () => {
    const tree = walkVendor(tmpDir);
    expect(tree.scannedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("walkVendor — AC2: ignores __pycache__ and .git", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-walk-"));
    mkFixture(tmpDir, {
      "proj-a/index.ts": "export {};\n",
      "proj-a/__pycache__/module.pyc": "bytecode",
      "proj-a/.git/HEAD": "ref: refs/heads/master",
      "proj-a/node_modules/dep/index.js": "module.exports = {}",
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should not include files from __pycache__, .git, or node_modules", () => {
    const tree = walkVendor(tmpDir);
    const proj = tree.projects.find((p) => p.name === "proj-a");
    expect(proj).toBeDefined();
    const filePaths = proj!.files.map((f) => f.path);
    expect(filePaths.every((p) => !p.includes("__pycache__"))).toBe(true);
    expect(filePaths.every((p) => !p.includes(".git"))).toBe(true);
    expect(filePaths.every((p) => !p.includes("node_modules"))).toBe(true);
  });
});

describe("walkVendor — AC3: captures README.md and SKILL.md", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-walk-"));
    mkFixture(tmpDir, {
      "proj-readme/README.md": "# Project A",
      "proj-readme/index.ts": "export {};\n",
      "proj-skill/SKILL.md": "# Skill",
      "proj-skill/index.ts": "export {};\n",
      "proj-neither/index.ts": "export {};\n",
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should capture README.md content in readme field", () => {
    const tree = walkVendor(tmpDir);
    const proj = tree.projects.find((p) => p.name === "proj-readme");
    expect(proj?.readme).toBe("# Project A");
  });

  it("should capture SKILL.md content in skill field", () => {
    const tree = walkVendor(tmpDir);
    const proj = tree.projects.find((p) => p.name === "proj-skill");
    expect(proj?.skill).toBe("# Skill");
  });

  it("should leave readme and skill undefined when absent", () => {
    const tree = walkVendor(tmpDir);
    const proj = tree.projects.find((p) => p.name === "proj-neither");
    expect(proj?.readme).toBeUndefined();
    expect(proj?.skill).toBeUndefined();
  });
});

describe("walkVendor — AC4: pure function (same input → same output)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-walk-"));
    mkFixture(tmpDir, {
      "proj-a/index.ts": "const x = 1;\n",
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return identical structure on two consecutive calls", () => {
    const t1 = walkVendor(tmpDir);
    const t2 = walkVendor(tmpDir);
    expect(t1.projects.length).toBe(t2.projects.length);
    expect(t1.projects[0]?.name).toBe(t2.projects[0]?.name);
    expect(t1.projects[0]?.files).toEqual(t2.projects[0]?.files);
  });
});

describe("walkVendor — file metadata", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-walk-"));
    mkFixture(tmpDir, {
      "proj-a/index.ts": "line1\nline2\nline3\n",
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should count LOC correctly", () => {
    const tree = walkVendor(tmpDir);
    const file = tree.projects[0]?.files.find((f) => f.path.endsWith("index.ts"));
    expect(file?.loc).toBe(3);
  });

  it("should include ext and sizeBytes", () => {
    const tree = walkVendor(tmpDir);
    const file = tree.projects[0]?.files.find((f) => f.path.endsWith("index.ts"));
    expect(file?.ext).toBe(".ts");
    expect(file?.sizeBytes).toBeGreaterThan(0);
  });
});
