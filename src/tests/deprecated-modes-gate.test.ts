/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DEPRECATED_MODES,
  resolveModeDeprecation,
  extractModeFromArgs,
} from "../mcp/deprecated-modes.js";
import type { DeprecationEntry } from "../mcp/deprecated-tools.js";

describe("DEPRECATED_MODES — V11 Maestro mode-deprecation", () => {
  beforeEach(() => {
    delete process.env.MCP_GRAPH_LEGACY_TOOLS;
  });
  afterEach(() => {
    delete process.env.MCP_GRAPH_LEGACY_TOOLS;
  });

  describe("DEPRECATED_MODES seed", () => {
    it("flags the three orphan analyze modes at advisory", () => {
      const orphans = ["cfd", "code_sync", "economy_simulation"];
      for (const mode of orphans) {
        const entry = DEPRECATED_MODES.analyze?.[mode];
        expect(entry, `analyze:${mode} must be in DEPRECATED_MODES`).toBeDefined();
        expect(entry?.stage).toBe("advisory");
        expect(entry?.replacement).toBeTruthy();
      }
    });

    it("does not flag healthy analyze modes", () => {
      expect(DEPRECATED_MODES.analyze?.ready).toBeUndefined();
      expect(DEPRECATED_MODES.analyze?.tdd_check).toBeUndefined();
      expect(DEPRECATED_MODES.analyze?.harness_scan).toBeUndefined();
    });
  });

  describe("extractModeFromArgs", () => {
    it("returns the mode string when args[0].mode is a string", () => {
      expect(extractModeFromArgs([{ mode: "cfd" }])).toBe("cfd");
      expect(extractModeFromArgs([{ mode: "ready", nodeId: "n1" }])).toBe("ready");
    });

    it("returns null when args is empty or has no mode", () => {
      expect(extractModeFromArgs([])).toBeNull();
      expect(extractModeFromArgs([{ nodeId: "n1" }])).toBeNull();
      expect(extractModeFromArgs([{}])).toBeNull();
    });

    it("returns null when mode is not a string", () => {
      expect(extractModeFromArgs([{ mode: 42 }])).toBeNull();
      expect(extractModeFromArgs([{ mode: null }])).toBeNull();
      expect(extractModeFromArgs([{ mode: undefined }])).toBeNull();
    });

    it("returns null for non-object first arg", () => {
      expect(extractModeFromArgs(["cfd"])).toBeNull();
      expect(extractModeFromArgs([null])).toBeNull();
    });
  });

  describe("resolveModeDeprecation", () => {
    it("returns null for healthy tool+mode pairs", () => {
      expect(resolveModeDeprecation("analyze", "ready")).toBeNull();
      expect(resolveModeDeprecation("metrics", "stats")).toBeNull();
    });

    it("returns the entry for a deprecated mode", () => {
      const r = resolveModeDeprecation("analyze", "cfd");
      expect(r).not.toBeNull();
      expect(r?.stage).toBe("advisory");
      expect(r?.replacement).toBeTruthy();
    });

    it("downgrades 'removed' to 'advisory' when MCP_GRAPH_LEGACY_TOOLS=on (rollback)", () => {
      const removed: DeprecationEntry = { stage: "removed", replacement: "x", sinceVersion: "v11" };
      process.env.MCP_GRAPH_LEGACY_TOOLS = "off";
      expect(resolveModeDeprecation("analyze", "x", removed)?.stage).toBe("removed");
      process.env.MCP_GRAPH_LEGACY_TOOLS = "on";
      expect(resolveModeDeprecation("analyze", "x", removed)?.stage).toBe("advisory");
    });

    it("does NOT downgrade 'warning' (rollback only affects 'removed')", () => {
      const warn: DeprecationEntry = { stage: "warning", replacement: "x", sinceVersion: "v11" };
      process.env.MCP_GRAPH_LEGACY_TOOLS = "on";
      expect(resolveModeDeprecation("analyze", "x", warn)?.stage).toBe("warning");
    });
  });
});
