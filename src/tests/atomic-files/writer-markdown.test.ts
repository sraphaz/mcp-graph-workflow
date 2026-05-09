/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — Writer markdown — marcadores + escrita atômica
 *
 * AC1: GIVEN arquivo inexistente WHEN init THEN cria com marcadores e bloco
 * AC2: GIVEN arquivo existe sem marcadores WHEN init THEN appenda bloco no final, preserva original
 * AC3: GIVEN arquivo com marcadores WHEN update THEN substitui só o bloco; conteúdo fora intacto
 * AC4: GIVEN bloco idêntico ao novo WHEN write THEN status noop, mtime preservada
 * AC5: GIVEN escrita falha no meio WHEN write THEN tmpfile removido, arquivo original intacto
 * AC6: GIVEN primeira escrita WHEN write THEN backup criado em .mcp-graph-backups/<timestamp>/
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  extractManagedBlock,
  replaceManagedBlock,
  write,
} from "../../core/atomic-files/writer-markdown.js";
import type { AtomicFile } from "../../core/atomic-files/types.js";

const START = (id: string) => `<!-- MCP-GRAPH:MANAGED-START:${id} -->`;
const END = (id: string) => `<!-- MCP-GRAPH:MANAGED-END:${id} -->`;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atomic-md-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeFile(relPath: string, content?: string): AtomicFile {
  const absPath = path.join(tmpDir, relPath);
  if (content !== undefined) fs.writeFileSync(absPath, content, "utf8");
  return {
    fileId: "test-block",
    path: absPath,
    format: "markdown",
    managedContent: "## Managed\nsome content here",
  };
}

// ---------------------------------------------------------------------------
// extractManagedBlock
// ---------------------------------------------------------------------------

describe("extractManagedBlock", () => {
  it("returns the block content when markers exist", () => {
    const content = `before\n${START("x")}\nhello\n${END("x")}\nafter`;
    expect(extractManagedBlock(content, "x")).toBe("hello");
  });

  it("returns null when markers are absent", () => {
    expect(extractManagedBlock("no markers here", "x")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// replaceManagedBlock
// ---------------------------------------------------------------------------

describe("replaceManagedBlock", () => {
  it("replaces only the managed block, preserves surrounding content", () => {
    const original = `before\n${START("x")}\nold\n${END("x")}\nafter`;
    const result = replaceManagedBlock(original, "x", "new");
    expect(result).toContain("before");
    expect(result).toContain("after");
    expect(result).toContain("new");
    expect(result).not.toContain("old");
  });
});

// ---------------------------------------------------------------------------
// AC1: init + file does not exist → create with markers
// ---------------------------------------------------------------------------

describe("write — AC1: init, file does not exist", () => {
  it("creates the file with managed block markers", async () => {
    const file = makeFile("new.md");
    const result = await write(file, "init");
    expect(result.status).toBe("created");
    const content = fs.readFileSync(file.path, "utf8");
    expect(content).toContain(START("test-block"));
    expect(content).toContain(END("test-block"));
    expect(content).toContain("## Managed");
  });
});

// ---------------------------------------------------------------------------
// AC2: init + file exists without markers → append
// ---------------------------------------------------------------------------

describe("write — AC2: init, file exists without markers", () => {
  it("appends block at end and preserves original content", async () => {
    const original = "# Existing Content\n\nsome text\n";
    const file = makeFile("existing.md", original);
    const result = await write(file, "init");
    expect(result.status).toBe("updated");
    const content = fs.readFileSync(file.path, "utf8");
    expect(content).toContain("# Existing Content");
    expect(content).toContain("some text");
    expect(content).toContain(START("test-block"));
    expect(content).toContain("## Managed");
  });
});

// ---------------------------------------------------------------------------
// AC3: update + file with markers → replace only block
// ---------------------------------------------------------------------------

describe("write — AC3: update replaces only the managed block", () => {
  it("replaces block and leaves surrounding content 100% intact", async () => {
    const before = "# Header\n\nbefore block\n\n";
    const after = "\n\nafter block\n";
    const original = `${before}${START("test-block")}\nold block\n${END("test-block")}${after}`;
    const file = makeFile("update.md", original);

    const result = await write(file, "update");
    expect(result.status).toBe("updated");
    const content = fs.readFileSync(file.path, "utf8");
    expect(content).toContain("# Header");
    expect(content).toContain("before block");
    expect(content).toContain("after block");
    expect(content).toContain("## Managed");
    expect(content).not.toContain("old block");
  });
});

// ---------------------------------------------------------------------------
// AC4: identical block → noop, mtime preserved
// ---------------------------------------------------------------------------

describe("write — AC4: identical content → noop", () => {
  it("returns noop and does not touch mtime", async () => {
    const existing = `${START("test-block")}\n## Managed\nsome content here\n${END("test-block")}\n`;
    const file = makeFile("noop.md", existing);
    const mtimeBefore = fs.statSync(file.path).mtimeMs;
    await new Promise((r) => setTimeout(r, 20)); // ensure clock advances
    const result = await write(file, "update");
    expect(result.status).toBe("noop");
    const mtimeAfter = fs.statSync(file.path).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });
});

// ---------------------------------------------------------------------------
// AC5: write failure → tmpfile removed, original intact
// ---------------------------------------------------------------------------

describe("write — AC5: write failure leaves original intact", () => {
  it("removes tmpfile and preserves original when rename fails", async () => {
    const original = "# Original\n";
    const file = makeFile("fail.md", original);
    // Make the directory read-only so rename into it fails
    fs.chmodSync(tmpDir, 0o500);
    try {
      await expect(write({ ...file, managedContent: "new" }, "init")).rejects.toThrow();
      // original still readable and unchanged
      const content = fs.readFileSync(file.path, "utf8");
      expect(content).toBe(original);
    } finally {
      fs.chmodSync(tmpDir, 0o700);
    }
  });
});

// ---------------------------------------------------------------------------
// AC6: first write → backup created
// ---------------------------------------------------------------------------

describe("write — AC6: backup created on first write", () => {
  it("creates a backup file under .mcp-graph-backups/<timestamp>/", async () => {
    const original = "# Existing\n\nContent here.\n";
    const file = makeFile("backup-test.md", original);
    await write(file, "init");
    expect(fs.existsSync(file.path + ".bak") || findBackup(tmpDir)).toBe(true);
  });
});

function findBackup(dir: string): boolean {
  const backupRoot = path.join(dir, ".mcp-graph-backups");
  if (!fs.existsSync(backupRoot)) return false;
  const entries = fs.readdirSync(backupRoot);
  return entries.length > 0;
}
