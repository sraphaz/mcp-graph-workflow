/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importCursorRules, installCursorBridge } from "../core/hooks/providers/cursor.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { setSharedHookBus } from "../core/hooks/shared-hook-bus.js";

describe("providers/cursor.ts — importCursorRules", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-cursor-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("returns rulesText when .cursor/rules exists", () => {
    const dir = join(tmp, ".cursor");
    mkdirSync(dir);
    const file = join(dir, "rules");
    writeFileSync(file, "Use TypeScript strict mode.\nNever use any.");
    const result = importCursorRules({ source: file });
    expect(result.rulesText).toContain("strict mode");
    expect(result.imported).toBe(1);
    expect(result.provider).toBe("cursor");
  });

  it("returns null when missing", () => {
    const result = importCursorRules({ source: join(tmp, "nope") });
    expect(result.rulesText).toBeNull();
    expect(result.imported).toBe(0);
  });
});

describe("providers/cursor.ts — installCursorBridge", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mcp-cursor-bridge-"));
    setSharedHookBus(new HookBus(new GraphEventBus()));
  });
  afterEach(() => {
    setSharedHookBus(null);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns dispose function (smoke)", () => {
    const dispose = installCursorBridge({ basePath: tmp });
    expect(typeof dispose).toBe("function");
    expect(() => dispose()).not.toThrow();
  });
});
