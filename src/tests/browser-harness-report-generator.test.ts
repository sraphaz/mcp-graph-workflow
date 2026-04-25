/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  buildHtmlReport,
  buildMarkdownReport,
  buildOctaneXml,
} from "../core/browser-harness/report-generator.js";
import type { HarnessRun } from "../schemas/browser-harness.schema.js";

const run: HarnessRun = {
  id: "bhrun_abc",
  sessionId: "bhsess_xyz",
  nodeId: null,
  prompt: "open https://example.com and verify <h1>",
  plan: [
    { index: 0, helper: "navigate", args: { url: "https://example.com" } },
    { index: 1, helper: "wait_for", args: { selector: "h1", timeoutMs: 5000 } },
  ],
  results: [
    { index: 0, helper: "navigate", ok: true, durationMs: 120, screenshotPath: "workflow-graph/browser-harness/screenshots/bhrun_abc/0.png", error: null },
    { index: 1, helper: "wait_for", ok: false, durationMs: 5004, screenshotPath: null, error: "selector not found before timeout: h1" },
  ],
  verdict: "fail",
  durationMs: 5300,
  createdAt: 1_700_000_000_000,
};

describe("report-generator", () => {
  it("builds an HTML report with all step info and verdict colour", () => {
    const html = buildHtmlReport({ run });
    expect(html).toContain("Browser Harness Run");
    expect(html).toContain(run.id);
    expect(html).toContain("FAIL");
    expect(html).toContain("navigate");
    expect(html).toContain("wait_for");
    expect(html).toContain("selector not found");
    // Self-contained — no external resources
    expect(html).not.toMatch(/<link[^>]*href=/);
    expect(html).not.toMatch(/<script[^>]*src=/);
  });

  it("embeds screenshots as base64 when provided", () => {
    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    const screenshots = new Map<number, Buffer>([[0, fakePng]]);
    const html = buildHtmlReport({ run, screenshots });
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain(fakePng.toString("base64"));
  });

  it("builds a Markdown report with a heading per step", () => {
    const md = buildMarkdownReport({ run });
    expect(md).toContain(`# Browser Harness Run \`${run.id}\``);
    expect(md).toContain("### #0 navigate");
    expect(md).toContain("### #1 wait_for");
    expect(md).toContain("FAIL");
    expect(md).toContain("> open https://example.com");
  });

  it("builds Octane-compatible JUnit-style XML", () => {
    const xml = buildOctaneXml({ run });
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(xml).toContain("<testsuites>");
    expect(xml).toContain('tests="2"');
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('classname="BrowserHarness.navigate"');
    expect(xml).toContain('classname="BrowserHarness.wait_for"');
    expect(xml).toContain('<failure type="HarnessFailure"');
    expect(xml).toContain("selector not found before timeout: h1");
  });

  it("xml-escapes prompt/error values to avoid injection", () => {
    const evil = { ...run, prompt: 'a"b<c>&d', results: [{ ...run.results[1], error: '<script>x</script>' }] };
    const xml = buildOctaneXml({ run: evil });
    expect(xml).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(xml).toContain("a&quot;b&lt;c&gt;&amp;d");
  });
});
