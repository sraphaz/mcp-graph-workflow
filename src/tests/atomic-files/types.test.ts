/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Tipos + interface
 *
 * AC1: GIVEN tipos exportados WHEN consumidos THEN sem `any`
 * AC2: GIVEN `AtomicFile` WHEN inspecionado THEN tem todos os campos para suportar markdown e json
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import type { AtomicFile, AtomicFileMode, WriteResult } from "../../core/atomic-files/types.js";

// ---------------------------------------------------------------------------
// AC2: AtomicFile has all required fields for markdown and json
// ---------------------------------------------------------------------------

describe("AtomicFile — AC2: all fields present", () => {
  it("should accept a markdown AtomicFile", () => {
    const f: AtomicFile = {
      fileId: "claude-md-integration-agents",
      path: "CLAUDE.md",
      format: "markdown",
      managedContent: "## Agents\nlist here",
    };
    expect(f.fileId).toBe("claude-md-integration-agents");
    expect(f.format).toBe("markdown");
  });

  it("should accept a json AtomicFile", () => {
    const f: AtomicFile = {
      fileId: "mcp-config",
      path: ".mcp.json",
      format: "json",
      managedContent: JSON.stringify({ mcpServers: {} }),
    };
    expect(f.format).toBe("json");
  });

  it("format should only accept markdown or json", () => {
    expectTypeOf<AtomicFile["format"]>().toEqualTypeOf<"markdown" | "json">();
  });
});

// ---------------------------------------------------------------------------
// AC1: No `any` — types are fully typed
// ---------------------------------------------------------------------------

describe("AtomicFileMode — AC1: fully typed", () => {
  it("should accept init", () => {
    const mode: AtomicFileMode = "init";
    expect(mode).toBe("init");
  });

  it("should accept update", () => {
    const mode: AtomicFileMode = "update";
    expect(mode).toBe("update");
  });

  it("should be a union of init | update", () => {
    expectTypeOf<AtomicFileMode>().toEqualTypeOf<"init" | "update">();
  });
});

describe("WriteResult — AC1: fully typed", () => {
  it("should accept status created", () => {
    const r: WriteResult = { status: "created" };
    expect(r.status).toBe("created");
  });

  it("should accept status with optional backupPath and diff", () => {
    const r: WriteResult = {
      status: "updated",
      backupPath: "/tmp/backup/CLAUDE.md.bak",
      diff: "- old line\n+ new line",
    };
    expect(r.backupPath).toBeDefined();
    expect(r.diff).toBeDefined();
  });

  it("should accept noop and preserved_external statuses", () => {
    const noop: WriteResult = { status: "noop" };
    const preserved: WriteResult = { status: "preserved_external" };
    expect(noop.status).toBe("noop");
    expect(preserved.status).toBe("preserved_external");
  });

  it("status should be the four expected literals", () => {
    expectTypeOf<WriteResult["status"]>().toEqualTypeOf<
      "created" | "updated" | "noop" | "preserved_external"
    >();
  });
});
