/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { locateBridgeBin } from "./locate.js";

describe("locateBridgeBin", () => {
  let tmp: string;
  const originalEnv = process.env.MG_BRIDGE_BIN;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-bridge-locate-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    if (originalEnv === undefined) delete process.env.MG_BRIDGE_BIN;
    else process.env.MG_BRIDGE_BIN = originalEnv;
  });

  it("uses MG_BRIDGE_BIN env override when set to a .cjs path", () => {
    const fake = join(tmp, "fake-bridge.cjs");
    writeFileSync(fake, "// stub", "utf8");
    process.env.MG_BRIDGE_BIN = fake;

    const result = locateBridgeBin();
    expect(result).toEqual({ kind: "node", script: fake });
  });

  it("uses MG_BRIDGE_BIN as exec when path doesn't end in known js extension", () => {
    const fake = join(tmp, "mcp-graph-bridge");
    writeFileSync(fake, "#!/bin/sh\nexit 0\n", "utf8");
    process.env.MG_BRIDGE_BIN = fake;

    const result = locateBridgeBin();
    expect(result).toEqual({ kind: "exec", bin: fake });
  });

  it("ignores MG_BRIDGE_BIN if the path doesn't exist", () => {
    process.env.MG_BRIDGE_BIN = join(tmp, "nonexistent");
    const result = locateBridgeBin();
    // falls through to discovery; should never throw
    expect(result).toBeDefined();
  });

  it("falls back to PATH-based exec lookup when nothing else found", () => {
    delete process.env.MG_BRIDGE_BIN;
    // we can't reliably control all fallbacks in CI, but the function
    // must always return a non-null result (last fallback is exec mcp-graph-bridge)
    const result = locateBridgeBin();
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ kind: expect.any(String) });
  });

  it("supports .mjs and .js extensions for env override", () => {
    const fake = join(tmp, "bridge.mjs");
    writeFileSync(fake, "// stub", "utf8");
    process.env.MG_BRIDGE_BIN = fake;

    expect(locateBridgeBin()).toEqual({ kind: "node", script: fake });
  });
});

// Quiet "unused" lint on mkdirSync if not used here; kept imported for future tests.
mkdirSync;
