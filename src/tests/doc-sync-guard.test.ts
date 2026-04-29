/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T02 — doc-sync guard tests.
 */

import { describe, it, expect } from "vitest";
import {
  detectDocDrift,
  hashDocContent,
  isDocSyncDisabled,
  DOC_DRIFT_AGE_DAYS,
} from "../core/hooks/doc-sync-guard.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("doc-sync-guard (E21.T02)", () => {
  it("DOC_DRIFT_AGE_DAYS = 7", () => {
    expect(DOC_DRIFT_AGE_DAYS).toBe(7);
  });

  it("hashDocContent stable for same content", () => {
    expect(hashDocContent("hello world")).toBe(hashDocContent("hello world"));
    expect(hashDocContent("a")).not.toBe(hashDocContent("b"));
  });

  it("returns no_baseline when baseline missing", () => {
    const r = detectDocDrift({
      path: "CLAUDE.md",
      currentContent: "x",
      latestNodeUpdateMs: Date.now(),
    });
    expect(r.drift).toBe(false);
    expect(r.reason).toBe("no_baseline");
  });

  it("returns content_changed when hash differs (no drift, baseline stale)", () => {
    const now = Date.now();
    const r = detectDocDrift({
      path: "CLAUDE.md",
      currentContent: "new content",
      baseline: {
        path: "CLAUDE.md",
        hash: hashDocContent("old content"),
        recordedAt: now - 10 * DAY_MS,
      },
      latestNodeUpdateMs: now,
      nowMs: now,
    });
    expect(r.drift).toBe(false);
    expect(r.reason).toBe("content_changed");
  });

  it("flags drift when same hash AND age > 7d AND node activity after baseline", () => {
    const now = Date.now();
    const content = "doc content";
    const r = detectDocDrift({
      path: "CLAUDE.md",
      currentContent: content,
      baseline: {
        path: "CLAUDE.md",
        hash: hashDocContent(content),
        recordedAt: now - 10 * DAY_MS,
      },
      latestNodeUpdateMs: now - 1 * DAY_MS,
      nowMs: now,
    });
    expect(r.drift).toBe(true);
    expect(r.reason).toBe("stale_doc");
    expect(r.ageDays).toBeGreaterThan(7);
  });

  it("does NOT flag drift when age <= 7d (even with node activity)", () => {
    const now = Date.now();
    const content = "doc content";
    const r = detectDocDrift({
      path: "CLAUDE.md",
      currentContent: content,
      baseline: {
        path: "CLAUDE.md",
        hash: hashDocContent(content),
        recordedAt: now - 3 * DAY_MS,
      },
      latestNodeUpdateMs: now - 1 * DAY_MS,
      nowMs: now,
    });
    expect(r.drift).toBe(false);
    expect(r.reason).toBe("fresh");
  });

  it("does NOT flag drift when no node activity after baseline", () => {
    const now = Date.now();
    const content = "doc content";
    const r = detectDocDrift({
      path: "CLAUDE.md",
      currentContent: content,
      baseline: {
        path: "CLAUDE.md",
        hash: hashDocContent(content),
        recordedAt: now - 30 * DAY_MS,
      },
      latestNodeUpdateMs: now - 60 * DAY_MS,
      nowMs: now,
    });
    expect(r.drift).toBe(false);
    expect(r.reason).toBe("fresh");
  });

  it("isDocSyncDisabled respects MCP_GRAPH_DOC_SYNC=off", () => {
    expect(isDocSyncDisabled({ MCP_GRAPH_DOC_SYNC: "off" })).toBe(true);
    expect(isDocSyncDisabled({})).toBe(false);
  });
});
