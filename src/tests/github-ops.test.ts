/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  isGhAvailable,
  openIssue,
  createPr,
  prStatus,
  type GhRunner,
  type GhRunResult,
} from "../core/autonomy/github-ops.js";

function ok(stdout: string): GhRunResult {
  return { ok: true, stdout, stderr: "", exitCode: 0 };
}
function fail(stderr = "boom"): GhRunResult {
  return { ok: false, stdout: "", stderr, exitCode: 1 };
}

function scriptedGh(pairs: ReadonlyArray<[string[], GhRunResult]>): GhRunner {
  let i = 0;
  return (args) => {
    if (i >= pairs.length) return fail("no more scripted responses");
    const [expected, result] = pairs[i++];
    if (expected.join(" ") !== (args as string[]).join(" ")) {
      return fail(`unexpected args: ${(args as string[]).join(" ")}`);
    }
    return result;
  };
}

describe("github-ops — isGhAvailable", () => {
  it("true when gh --version exits 0", () => {
    const runner = scriptedGh([[["--version"], ok("gh version 2.40.0")]]);
    expect(isGhAvailable({ runner })).toBe(true);
  });
  it("false when gh fails / not on PATH", () => {
    const runner = scriptedGh([[["--version"], fail("not found")]]);
    expect(isGhAvailable({ runner })).toBe(false);
  });
});

describe("github-ops — openIssue", () => {
  it("returns unsupported when gh is missing", () => {
    const runner = scriptedGh([[["--version"], fail()]]);
    const r = openIssue({ title: "t", body: "b" }, { runner });
    expect(r.kind).toBe("unsupported");
  });

  it("parses issue number from URL", () => {
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [
        ["issue", "create", "--title", "t", "--body", "b"],
        ok("https://github.com/o/r/issues/42\n"),
      ],
    ]);
    const r = openIssue({ title: "t", body: "b" }, { runner });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.data.number).toBe(42);
      expect(r.data.url).toBe("https://github.com/o/r/issues/42");
    }
  });

  it("forwards labels as a comma-joined string", () => {
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [
        ["issue", "create", "--title", "t", "--body", "b", "--label", "bug,p0"],
        ok("https://github.com/o/r/issues/9"),
      ],
    ]);
    const r = openIssue({ title: "t", body: "b", labels: ["bug", "p0"] }, { runner });
    expect(r.kind).toBe("ok");
  });

  it("returns error on gh non-zero exit", () => {
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [["issue", "create", "--title", "t", "--body", "b"], fail("auth required")],
    ]);
    const r = openIssue({ title: "t", body: "b" }, { runner });
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.reason).toContain("auth required");
  });
});

describe("github-ops — createPr", () => {
  it("parses PR number from URL", () => {
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [
        ["pr", "create", "--title", "t", "--body", "b", "--base", "master"],
        ok("https://github.com/o/r/pull/123\n"),
      ],
    ]);
    const r = createPr({ title: "t", body: "b", base: "master" }, { runner });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.data.number).toBe(123);
  });

  it("appends --draft when requested", () => {
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [
        ["pr", "create", "--title", "t", "--body", "b", "--base", "main", "--draft"],
        ok("https://github.com/o/r/pull/7"),
      ],
    ]);
    const r = createPr({ title: "t", body: "b", base: "main", draft: true }, { runner });
    expect(r.kind).toBe("ok");
  });
});

describe("github-ops — prStatus", () => {
  it("rolls up SUCCESS when all checks succeeded", () => {
    const json = JSON.stringify({
      state: "OPEN",
      mergeable: "MERGEABLE",
      statusCheckRollup: [
        { conclusion: "SUCCESS" },
        { conclusion: "SUCCESS" },
      ],
    });
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [
        ["pr", "view", "10", "--json", "state,statusCheckRollup,mergeable"],
        ok(json),
      ],
    ]);
    const r = prStatus(10, { runner });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.data.state).toBe("OPEN");
      expect(r.data.checks).toBe("SUCCESS");
      expect(r.data.mergeable).toBe(true);
    }
  });

  it("rolls up FAILURE when any check failed", () => {
    const json = JSON.stringify({
      state: "OPEN",
      mergeable: "CONFLICTING",
      statusCheckRollup: [
        { conclusion: "SUCCESS" },
        { conclusion: "FAILURE" },
      ],
    });
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [
        ["pr", "view", "10", "--json", "state,statusCheckRollup,mergeable"],
        ok(json),
      ],
    ]);
    const r = prStatus(10, { runner });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.data.checks).toBe("FAILURE");
      expect(r.data.mergeable).toBe(false);
    }
  });

  it("returns PENDING when at least one check is in progress", () => {
    const json = JSON.stringify({
      state: "OPEN",
      mergeable: "UNKNOWN",
      statusCheckRollup: [
        { conclusion: "SUCCESS" },
        { status: "IN_PROGRESS" },
      ],
    });
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [
        ["pr", "view", "10", "--json", "state,statusCheckRollup,mergeable"],
        ok(json),
      ],
    ]);
    const r = prStatus(10, { runner });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.data.checks).toBe("PENDING");
      expect(r.data.mergeable).toBeNull();
    }
  });

  it("returns error on malformed JSON", () => {
    const runner = scriptedGh([
      [["--version"], ok("gh 2.40.0")],
      [
        ["pr", "view", "10", "--json", "state,statusCheckRollup,mergeable"],
        ok("not json"),
      ],
    ]);
    const r = prStatus(10, { runner });
    expect(r.kind).toBe("error");
  });
});
