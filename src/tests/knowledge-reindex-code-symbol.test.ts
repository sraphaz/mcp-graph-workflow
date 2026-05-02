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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { CodeStore } from "../core/code/code-store.js";
import { CodeIndexer } from "../core/code/code-indexer.js";
import { handleReindex } from "../mcp/tools/knowledge.js";
import { detectStaleIndex } from "../mcp/unified-gate.js";

function makeFixtureRepo(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reindex-fixture-"));
  fs.writeFileSync(
    path.join(dir, "alpha.ts"),
    "export function alpha(): number { return 1; }\nexport const ALPHA_CONST = 'a';\n",
  );
  fs.writeFileSync(
    path.join(dir, "beta.ts"),
    "export class Beta { greet(): string { return 'hi'; } }\n",
  );
  // Init a real git repo so getGitHash() returns a stable hash.
  const env = { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@e.x", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@e.x" };
  execSync("git init -q", { cwd: dir, env });
  execSync("git add -A && git -c commit.gpgsign=false commit -q -m init", { cwd: dir, env });
  const cleanup = (): void => fs.rmSync(dir, { recursive: true, force: true });
  return { dir, cleanup };
}

function getHeadHash(dir: string): string {
  return execSync("git rev-parse HEAD", { cwd: dir, encoding: "utf-8", timeout: 5000 }).trim();
}

describe("knowledge(action:reindex, sources:['code']) — symbol-index refresh", () => {
  let store: SqliteStore;
  let fixture: { dir: string; cleanup: () => void };

  beforeEach(async () => {
    fixture = makeFixtureRepo();
    store = SqliteStore.open(":memory:");
    store.initProject("test-reindex-code");
    const project = store.getProject();
    if (!project) throw new Error("project init failed");
    const codeStore = new CodeStore(store.getDb());
    const indexer = new CodeIndexer(codeStore, project.id);
    await indexer.indexDirectory(fixture.dir, fixture.dir);
  });

  afterEach(() => {
    store.close();
    fixture.cleanup();
  });

  it("refreshes code_index_meta.git_hash to match current HEAD after reindex", async () => {
    const project = store.getProject()!;
    const codeStore = new CodeStore(store.getDb());

    store.getDb()
      .prepare("UPDATE code_index_meta SET git_hash = 'STALE_DEADBEEF' WHERE project_id = ?")
      .run(project.id);
    expect(detectStaleIndex(codeStore, project.id, getHeadHash(fixture.dir)).stale).toBe(true);

    await handleReindex(store, fixture.dir, ["code"]);

    const expectedHash = getHeadHash(fixture.dir);
    const meta = codeStore.getIndexMeta(project.id);
    expect(meta?.gitHash).toBe(expectedHash);
    expect(detectStaleIndex(codeStore, project.id, expectedHash).stale).toBe(false);
  });

  it("advances code_index_meta.last_indexed past the pre-call timestamp", async () => {
    const project = store.getProject()!;
    const codeStore = new CodeStore(store.getDb());
    const beforeTs = codeStore.getIndexMeta(project.id)?.lastIndexed ?? "";

    await new Promise((r) => setTimeout(r, 5));

    await handleReindex(store, fixture.dir, ["code"]);

    const afterMeta = codeStore.getIndexMeta(project.id);
    expect(afterMeta?.lastIndexed).toBeTruthy();
    expect(afterMeta!.lastIndexed > beforeTs).toBe(true);
  });

  it("returns symbolIndex and ragContext result blocks (new shape)", async () => {
    const result = await handleReindex(store, fixture.dir, ["code"]);
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    const parsed = JSON.parse(text) as { code?: { symbolIndex?: { symbolCount: number }; ragContext?: { documentsIndexed: number }; error?: string } };

    expect(parsed.code).toBeDefined();
    expect(parsed.code?.error).toBeUndefined();
    expect(parsed.code?.symbolIndex).toBeDefined();
    expect(parsed.code?.symbolIndex?.symbolCount).toBeGreaterThan(0);
    expect(parsed.code?.ragContext).toBeDefined();
  });
});
