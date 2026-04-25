/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fingerprintProject } from "./detect.js";
import { scaffoldProject } from "./scaffold.js";

describe("init/scaffold", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-init-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("creates workflow-graph dir, .gitignore, and PRD.md on a clean dir", () => {
    const result = scaffoldProject(tmp);

    const actions = result.changes.map((c) => c.action);
    expect(actions).toContain("created");
    expect(readFileSync(join(tmp, ".gitignore"), "utf8")).toContain(
      "workflow-graph/",
    );
    expect(readFileSync(join(tmp, "PRD.md"), "utf8")).toContain(
      "Sample PRD",
    );
  });

  it("is idempotent — running twice yields no-op on second call", () => {
    scaffoldProject(tmp);
    const second = scaffoldProject(tmp);

    for (const change of second.changes) {
      expect(["skipped-existing", "skipped-noop"]).toContain(change.action);
    }
  });

  it("patches .gitignore without duplicating entries", () => {
    writeFileSync(join(tmp, ".gitignore"), "node_modules\n", "utf8");
    scaffoldProject(tmp);
    const result = scaffoldProject(tmp);

    const gitignoreChange = result.changes.find((c) =>
      c.path.endsWith(".gitignore"),
    );
    expect(gitignoreChange?.action).toBe("skipped-noop");

    const content = readFileSync(join(tmp, ".gitignore"), "utf8");
    const matches = content.match(/^workflow-graph\/$/gm) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("preserves existing PRD.md unless --force", () => {
    writeFileSync(join(tmp, "PRD.md"), "MY OWN PRD", "utf8");
    const result = scaffoldProject(tmp);
    const prdChange = result.changes.find((c) => c.path.endsWith("PRD.md"));
    expect(prdChange?.action).toBe("skipped-existing");
    expect(readFileSync(join(tmp, "PRD.md"), "utf8")).toBe("MY OWN PRD");
  });

  it("overwrites PRD.md when force=true", () => {
    writeFileSync(join(tmp, "PRD.md"), "MY OWN PRD", "utf8");
    scaffoldProject(tmp, { force: true });
    expect(readFileSync(join(tmp, "PRD.md"), "utf8")).toContain(
      "Sample PRD",
    );
  });

  describe("fingerprintProject", () => {
    it("detects node project from package.json", () => {
      writeFileSync(
        join(tmp, "package.json"),
        '{"name":"test-app"}',
        "utf8",
      );
      const fp = fingerprintProject(tmp);
      expect(fp.projectType).toBe("node");
      expect(fp.packageName).toBe("test-app");
    });

    it("detects python project from pyproject.toml", () => {
      writeFileSync(join(tmp, "pyproject.toml"), "", "utf8");
      const fp = fingerprintProject(tmp);
      expect(fp.projectType).toBe("python");
    });

    it("falls back to generic when no markers exist", () => {
      const fp = fingerprintProject(tmp);
      expect(fp.projectType).toBe("generic");
      expect(fp.ides).toEqual([]);
    });
  });
});
