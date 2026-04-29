/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  currentHead,
  commitsBetween,
  diffStat,
  diffForFile,
  changedFiles,
  revert,
  bisect,
  currentBranch,
  isClean,
  type GitRunner,
  type GitRunResult,
} from "../core/autonomy/git-ops.js";

function ok(stdout: string): GitRunResult {
  return { ok: true, stdout, stderr: "", exitCode: 0 };
}
function fail(stderr = "boom", exitCode = 1): GitRunResult {
  return { ok: false, stdout: "", stderr, exitCode };
}

function scriptedRunner(pairs: ReadonlyArray<[string[], GitRunResult]>): GitRunner {
  let i = 0;
  return (args) => {
    if (i >= pairs.length) {
      return fail(`no more scripted responses (got ${args.join(" ")})`, 99);
    }
    const [expected, result] = pairs[i++];
    if (expected.join(" ") !== (args as string[]).join(" ")) {
      return fail(`unexpected args: got ${(args as string[]).join(" ")} want ${expected.join(" ")}`, 99);
    }
    return result;
  };
}

describe("git-ops — currentHead", () => {
  it("returns trimmed SHA on success", () => {
    const runner = scriptedRunner([[["rev-parse", "HEAD"], ok("abc123\n")]]);
    expect(currentHead({ runner })).toBe("abc123");
  });

  it("returns null when not in a repo", () => {
    const runner = scriptedRunner([[["rev-parse", "HEAD"], fail("not a git repo", 128)]]);
    expect(currentHead({ runner })).toBeNull();
  });
});

describe("git-ops — commitsBetween", () => {
  it("returns the SHA list newest first", () => {
    const runner = scriptedRunner([
      [["rev-list", "main..HEAD"], ok("c1\nc2\nc3\n")],
    ]);
    expect(commitsBetween("main", "HEAD", { runner })).toEqual(["c1", "c2", "c3"]);
  });

  it("returns [] on failure", () => {
    const runner = scriptedRunner([[["rev-list", "main..HEAD"], fail()]]);
    expect(commitsBetween("main", "HEAD", { runner })).toEqual([]);
  });

  it("filters empty lines", () => {
    const runner = scriptedRunner([[["rev-list", "main..HEAD"], ok("a\n\nb\n\n")]]);
    expect(commitsBetween("main", "HEAD", { runner })).toEqual(["a", "b"]);
  });
});

describe("git-ops — diffStat", () => {
  it("parses files/insertions/deletions from shortstat", () => {
    const runner = scriptedRunner([
      [["diff", "--shortstat", "abc^!"], ok(" 3 files changed, 47 insertions(+), 12 deletions(-)\n")],
    ]);
    expect(diffStat("abc", { runner })).toEqual({
      filesChanged: 3,
      insertions: 47,
      deletions: 12,
    });
  });

  it("handles single file (no plural)", () => {
    const runner = scriptedRunner([
      [["diff", "--shortstat", "abc^!"], ok(" 1 file changed, 1 insertion(+)\n")],
    ]);
    expect(diffStat("abc", { runner })).toEqual({
      filesChanged: 1,
      insertions: 1,
      deletions: 0,
    });
  });

  it("returns zeros on failure", () => {
    const runner = scriptedRunner([[["diff", "--shortstat", "abc^!"], fail()]]);
    expect(diffStat("abc", { runner })).toEqual({ filesChanged: 0, insertions: 0, deletions: 0 });
  });
});

describe("git-ops — revert", () => {
  it("returns ok=true and refreshes HEAD on success", () => {
    const runner = scriptedRunner([
      [["revert", "--no-edit", "bad-sha"], ok("Revert done\n")],
      [["rev-parse", "HEAD"], ok("new-head\n")],
    ]);
    expect(revert("bad-sha", { runner })).toEqual({ ok: true, newHead: "new-head", stderr: "" });
  });

  it("returns ok=false with stderr on conflict", () => {
    const runner = scriptedRunner([
      [["revert", "--no-edit", "bad-sha"], fail("conflict in foo.ts", 1)],
    ]);
    expect(revert("bad-sha", { runner })).toEqual({
      ok: false,
      newHead: null,
      stderr: "conflict in foo.ts",
    });
  });
});

describe("git-ops — bisect (linear walk)", () => {
  it("returns the first SHA the predicate calls bad", () => {
    const runner = scriptedRunner([
      [["rev-list", "good..bad"], ok("c1\nc2\nc3\n")],
    ]);
    const seen: string[] = [];
    const result = bisect(
      "good",
      "bad",
      (sha) => {
        seen.push(sha);
        return sha === "c2" ? "bad" : "skip";
      },
      { runner },
    );
    expect(result).toBe("c2");
    expect(seen).toEqual(["c1", "c2"]);
  });

  it("returns null when predicate never finds bad", () => {
    const runner = scriptedRunner([[["rev-list", "good..bad"], ok("c1\nc2\n")]]);
    expect(
      bisect("good", "bad", () => "skip", { runner }),
    ).toBeNull();
  });

  it("returns null when predicate calls good (search collapses)", () => {
    const runner = scriptedRunner([[["rev-list", "good..bad"], ok("c1\nc2\n")]]);
    expect(bisect("good", "bad", () => "good", { runner })).toBeNull();
  });
});

describe("git-ops — currentBranch", () => {
  it("returns branch name on success", () => {
    const runner = scriptedRunner([
      [["rev-parse", "--abbrev-ref", "HEAD"], ok("feat/v13\n")],
    ]);
    expect(currentBranch({ runner })).toBe("feat/v13");
  });

  it("returns null when detached (HEAD)", () => {
    const runner = scriptedRunner([
      [["rev-parse", "--abbrev-ref", "HEAD"], ok("HEAD\n")],
    ]);
    expect(currentBranch({ runner })).toBeNull();
  });
});

describe("git-ops — diffForFile", () => {
  it("returns the diff body on success", () => {
    const runner = scriptedRunner([
      [["diff", "--unified=3", "HEAD", "--", "src/x.ts"], ok("@@ +1 +1 @@\n-old\n+new\n")],
    ]);
    expect(diffForFile("src/x.ts", "HEAD", { runner })).toContain("+new");
  });

  it("returns empty string on git failure", () => {
    const runner = scriptedRunner([
      [["diff", "--unified=3", "HEAD", "--", "missing.ts"], fail()],
    ]);
    expect(diffForFile("missing.ts", "HEAD", { runner })).toBe("");
  });
});

describe("git-ops — changedFiles", () => {
  it("parses additions, deletions, path from numstat", () => {
    const runner = scriptedRunner([
      [
        ["diff", "--numstat", "HEAD"],
        ok("47\t12\tsrc/core/x.ts\n89\t0\tsrc/tests/x.test.ts\n"),
      ],
    ]);
    expect(changedFiles("HEAD", { runner })).toEqual([
      { path: "src/core/x.ts", additions: 47, deletions: 12 },
      { path: "src/tests/x.test.ts", additions: 89, deletions: 0 },
    ]);
  });

  it("treats binary diff markers ('-') as zero", () => {
    const runner = scriptedRunner([
      [["diff", "--numstat", "HEAD"], ok("-\t-\timg.png\n")],
    ]);
    expect(changedFiles("HEAD", { runner })).toEqual([
      { path: "img.png", additions: 0, deletions: 0 },
    ]);
  });

  it("returns [] on git failure", () => {
    const runner = scriptedRunner([[["diff", "--numstat", "HEAD"], fail()]]);
    expect(changedFiles("HEAD", { runner })).toEqual([]);
  });
});

describe("git-ops — isClean", () => {
  it("true when porcelain is empty", () => {
    const runner = scriptedRunner([[["status", "--porcelain"], ok("")]]);
    expect(isClean({ runner })).toBe(true);
  });

  it("false when porcelain has any line", () => {
    const runner = scriptedRunner([[["status", "--porcelain"], ok(" M foo.ts\n")]]);
    expect(isClean({ runner })).toBe(false);
  });
});
