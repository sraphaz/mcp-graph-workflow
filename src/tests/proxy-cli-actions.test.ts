/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §PRD-mcp-graph-proxy — proxy CLI action handlers tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  tokenAction,
  statusAction,
  startActionStub,
  stopActionStub,
} from "../core/proxy/proxy-cli-actions.js";

describe("proxy CLI actions", () => {
  let dir: string;
  let tokenPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "proxy-"));
    tokenPath = join(dir, "proxy.token");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("token action creates a fresh token when none exists (rotated=false)", () => {
    const r = tokenAction({ tokenPath });
    expect(r.rotated).toBe(false);
    expect(r.activeTokenPreview).toMatch(/^mcpg_/);
    expect(r.previousTokenPreview).toBeUndefined();
    expect(existsSync(tokenPath)).toBe(true);
  });

  it("token action rotates when token already exists (rotated=true; previous preserved)", () => {
    const a = tokenAction({ tokenPath });
    const b = tokenAction({ tokenPath });
    expect(b.rotated).toBe(true);
    expect(b.previousTokenPreview).toBe(a.activeTokenPreview);
    expect(b.activeTokenPreview).not.toBe(a.activeTokenPreview);
  });

  it("token file is written with mode 0600 (POSIX)", () => {
    tokenAction({ tokenPath });
    const mode = statSync(tokenPath).mode & 0o777;
    if (process.platform !== "win32") {
      expect(mode.toString(8)).toBe("600");
    }
  });

  it("token file is valid JSON containing a BearerStore", () => {
    tokenAction({ tokenPath });
    const parsed = JSON.parse(readFileSync(tokenPath, "utf-8"));
    expect(parsed.active).toBeDefined();
    expect(typeof parsed.active.token).toBe("string");
  });

  it("status reports exists=false before any token is created", () => {
    const r = statusAction({ tokenPath });
    expect(r.exists).toBe(false);
    expect(r.activeTokenPreview).toBeUndefined();
  });

  it("status reports exists=true and not expired immediately after token creation", () => {
    tokenAction({ tokenPath });
    const r = statusAction({ tokenPath });
    expect(r.exists).toBe(true);
    expect(r.expired).toBe(false);
    expect(r.activeTokenPreview).toMatch(/^mcpg_/);
  });

  it("status reports expired=true when the active token is past its TTL", () => {
    tokenAction({ tokenPath, now: () => 0 });
    // Advance fake clock 100 days into the future
    const future = 100 * 24 * 60 * 60 * 1000;
    const r = statusAction({ tokenPath, now: () => future });
    expect(r.expired).toBe(true);
  });

  it("start/stop stubs return surface payloads (action wiring deferred to CLI layer)", () => {
    expect(startActionStub().action).toBe("start");
    expect(stopActionStub().action).toBe("stop");
  });
});
