/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateSerenaMemories } from "../core/memory/memory-migrator.js";
import { STORE_DIR } from "../core/utils/constants.js";

describe("migrateSerenaMemories", () => {
  let basePath: string;

  beforeEach(() => {
    basePath = mkdtempSync(join(tmpdir(), "memory-migrator-"));
  });

  afterEach(() => {
    rmSync(basePath, { recursive: true, force: true });
  });

  it("returns {0,0} when source dir does not exist", async () => {
    const result = await migrateSerenaMemories(basePath);
    expect(result).toEqual({ migrated: 0, skipped: 0 });
  });

  it("migrates .md files from .serena/memories/ to workflow-graph/memories/", async () => {
    const sourceDir = join(basePath, ".serena/memories");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "alpha.md"), "alpha content");
    writeFileSync(join(sourceDir, "beta.md"), "beta content");

    const result = await migrateSerenaMemories(basePath);

    expect(result).toEqual({ migrated: 2, skipped: 0 });
    const targetDir = join(basePath, STORE_DIR, "memories");
    expect(readFileSync(join(targetDir, "alpha.md"), "utf-8")).toBe("alpha content");
    expect(readFileSync(join(targetDir, "beta.md"), "utf-8")).toBe("beta content");
  });

  it("skips files that already exist in target (does not overwrite)", async () => {
    const sourceDir = join(basePath, ".serena/memories");
    const targetDir = join(basePath, STORE_DIR, "memories");
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(sourceDir, "shared.md"), "from-source");
    writeFileSync(join(targetDir, "shared.md"), "preserved-original");

    const result = await migrateSerenaMemories(basePath);

    expect(result).toEqual({ migrated: 0, skipped: 1 });
    expect(readFileSync(join(targetDir, "shared.md"), "utf-8")).toBe("preserved-original");
  });

  it("preserves nested directory structure", async () => {
    const sourceDir = join(basePath, ".serena/memories/sub/deep");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "nested.md"), "nested content");

    const result = await migrateSerenaMemories(basePath);

    expect(result.migrated).toBe(1);
    const expected = join(basePath, STORE_DIR, "memories", "sub/deep/nested.md");
    expect(existsSync(expected)).toBe(true);
  });

  it("ignores non-.md files in the source", async () => {
    const sourceDir = join(basePath, ".serena/memories");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "doc.md"), "md content");
    writeFileSync(join(sourceDir, "data.txt"), "txt content");
    writeFileSync(join(sourceDir, "code.ts"), "ts content");

    const result = await migrateSerenaMemories(basePath);

    expect(result.migrated).toBe(1);
  });

  it("returns {0,0} when source dir is empty", async () => {
    const sourceDir = join(basePath, ".serena/memories");
    mkdirSync(sourceDir, { recursive: true });

    const result = await migrateSerenaMemories(basePath);

    expect(result).toEqual({ migrated: 0, skipped: 0 });
  });
});
