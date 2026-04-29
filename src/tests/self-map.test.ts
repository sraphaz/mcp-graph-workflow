/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { classifyRegression, buildIssueBody } from "../core/autonomy/self-map.js";

describe("self-map — classifyRegression", () => {
  it("harness drop ≤ -5 → harness-drop bucket", () => {
    const r = classifyRegression({ harnessDelta: -7 });
    expect(r.bucket).toBe("harness-drop");
    expect(r.labels).toContain("harness");
    expect(r.suggestedTitle).toContain("7 points");
  });

  it("harness drop above threshold (-3) does NOT trigger harness-drop", () => {
    const r = classifyRegression({ harnessDelta: -3 });
    expect(r.bucket).toBe("unknown");
  });

  it("perf delta ≥ 20% → perf-regression", () => {
    const r = classifyRegression({ perfDelta: 0.25 });
    expect(r.bucket).toBe("perf-regression");
    expect(r.suggestedTitle).toContain("25%");
  });

  it("test-flake pattern in ciOutput → test-flake bucket", () => {
    const r = classifyRegression({ ciOutput: "Test failed (retry 3/3) — timeout exceeded" });
    expect(r.bucket).toBe("test-flake");
  });

  it("build-failure pattern → build-failure bucket", () => {
    const r = classifyRegression({ ciOutput: "npm ERR! Cannot find module 'foo'" });
    expect(r.bucket).toBe("build-failure");
  });

  it("api-break pattern → api-break bucket", () => {
    const r = classifyRegression({ ciOutput: "Property 'oldName' does not exist on type 'Bar'" });
    expect(r.bucket).toBe("api-break");
  });

  it("TS error pattern → type-regression bucket", () => {
    const r = classifyRegression({ ciOutput: "src/foo.ts(10,1): error TS2322: ..." });
    expect(r.bucket).toBe("type-regression");
  });

  it("falls back to 'unknown' with needs-triage label", () => {
    const r = classifyRegression({ ciOutput: "something unspecific" });
    expect(r.bucket).toBe("unknown");
    expect(r.labels).toContain("needs-triage");
  });

  it("harness signal wins over text signal (numeric is unambiguous)", () => {
    const r = classifyRegression({
      harnessDelta: -8,
      ciOutput: "Property 'x' does not exist on type 'Y'",
    });
    expect(r.bucket).toBe("harness-drop");
  });
});

describe("self-map — buildIssueBody", () => {
  it("renders bucket, rationale, suspect SHA and bisect trail", () => {
    const cls = classifyRegression({ harnessDelta: -10 });
    const body = buildIssueBody({
      classification: cls,
      suspectSha: "abc123",
      bisectTrail: ["abc123", "def456"],
    });
    expect(body).toContain("**Bucket:** `harness-drop`");
    expect(body).toContain("`abc123`");
    expect(body).toContain("`def456`");
    expect(body).toContain("auto-merge orchestrator");
  });

  it("omits sections that have no content", () => {
    const cls = classifyRegression({ ciOutput: "retry 3/3 timeout exceeded" });
    const body = buildIssueBody({ classification: cls, suspectSha: null });
    expect(body).not.toContain("## Bisect trail");
    expect(body).not.toContain("## CI excerpt");
  });

  it("clamps long ciOutputExcerpt to 2000 chars", () => {
    const huge = "x".repeat(4000);
    const cls = classifyRegression({});
    const body = buildIssueBody({
      classification: cls,
      suspectSha: null,
      ciOutputExcerpt: huge,
    });
    // 2000 inside the code fence + the surrounding markdown overhead
    const fence = body.split("```")[1] ?? "";
    expect(fence.replace(/\n/g, "").length).toBeLessThanOrEqual(2001);
  });
});
