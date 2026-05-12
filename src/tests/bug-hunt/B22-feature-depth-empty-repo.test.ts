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

/**
 * B22 (P2): analyze(mode: "feature_depth") deve falhar com erro acionável
 * quando o cwd não tem fontes Go (ou go.mod) — não com stderr vazio.
 *
 * §bug-hunt node_3741375074f4
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("B22 — analyze feature_depth no-source-files pre-check", () => {
  const tmps: string[] = [];

  afterEach(async () => {
    for (const d of tmps) {
      await rm(d, { recursive: true, force: true });
    }
    tmps.length = 0;
  });

  async function makeTmpDir(): Promise<string> {
    const d = await mkdtemp(join(tmpdir(), "b22-"));
    tmps.push(d);
    return d;
  }

  it("hasSourceFiles returns false for an empty directory", async () => {
    const { hasSourceFiles } = await import(
      "../../core/analyzer/feature-depth-mode.js"
    );
    const dir = await makeTmpDir();
    expect(await hasSourceFiles(dir)).toBe(false);
  });

  it("hasSourceFiles returns false for a directory with only non-source files", async () => {
    const { hasSourceFiles } = await import(
      "../../core/analyzer/feature-depth-mode.js"
    );
    const dir = await makeTmpDir();
    await writeFile(join(dir, "README.md"), "# hello");
    await writeFile(join(dir, "config.json"), "{}");
    expect(await hasSourceFiles(dir)).toBe(false);
  });

  it("hasSourceFiles returns true for a directory with a .go file", async () => {
    const { hasSourceFiles } = await import(
      "../../core/analyzer/feature-depth-mode.js"
    );
    const dir = await makeTmpDir();
    await writeFile(join(dir, "main.go"), "package main\n");
    expect(await hasSourceFiles(dir)).toBe(true);
  });

  it("hasSourceFiles returns true for a directory with a .ts file", async () => {
    const { hasSourceFiles } = await import(
      "../../core/analyzer/feature-depth-mode.js"
    );
    const dir = await makeTmpDir();
    await writeFile(join(dir, "index.ts"), "export const x = 1;\n");
    expect(await hasSourceFiles(dir)).toBe(true);
  });
});
