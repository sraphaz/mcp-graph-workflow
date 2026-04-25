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
  DEPRECATED_TOOLS,
  resolveDeprecation,
  buildRemovedResponse,
  attachDeprecationNotice,
  type DeprecationStage,
} from "../mcp/deprecated-tools.js";

describe("DEPRECATED_TOOLS — V11 Maestro Phase 5.1", () => {
  beforeEach(() => {
    delete process.env.MCP_GRAPH_LEGACY_TOOLS;
  });

  afterEach(() => {
    delete process.env.MCP_GRAPH_LEGACY_TOOLS;
  });

  describe("DEPRECATED_TOOLS map", () => {
    it("includes the V11 Maestro candidates at advisory stage", () => {
      const candidates = ["davinci", "siebel", "translate", "forecast"];
      for (const tool of candidates) {
        const entry = DEPRECATED_TOOLS[tool];
        expect(entry, `${tool} must be in DEPRECATED_TOOLS`).toBeDefined();
        expect(entry?.stage).toBe("advisory");
        expect(entry?.replacement).toBeTruthy();
      }
    });

    it("every entry has a replacement string and a sinceVersion", () => {
      for (const [tool, entry] of Object.entries(DEPRECATED_TOOLS)) {
        expect(entry.replacement, `${tool} must have a replacement`).toBeTruthy();
        expect(entry.sinceVersion, `${tool} must have a sinceVersion`).toBeTruthy();
      }
    });
  });

  describe("resolveDeprecation", () => {
    it("returns null for non-deprecated tools", () => {
      expect(resolveDeprecation("list")).toBeNull();
      expect(resolveDeprecation("query_graph")).toBeNull();
    });

    it("returns the entry for a deprecated tool at its declared stage", () => {
      const r = resolveDeprecation("davinci");
      expect(r).not.toBeNull();
      expect(r?.stage).toBe("advisory");
      expect(r?.replacement).toBeTruthy();
    });

    it("downgrades 'removed' tools to 'advisory' when MCP_GRAPH_LEGACY_TOOLS=on (rollback)", () => {
      const stages: DeprecationStage[] = ["advisory", "warning", "removed"];
      for (const stage of stages) {
        const entry = { stage, replacement: "x", sinceVersion: "v11" };
        // No env flag — stage is preserved
        process.env.MCP_GRAPH_LEGACY_TOOLS = "off";
        expect(resolveDeprecation("imaginary", entry)?.stage).toBe(stage);
        // Flag on — only "removed" downgrades to "advisory"
        process.env.MCP_GRAPH_LEGACY_TOOLS = "on";
        expect(resolveDeprecation("imaginary", entry)?.stage).toBe(
          stage === "removed" ? "advisory" : stage,
        );
      }
    });
  });

  describe("buildRemovedResponse", () => {
    it("returns a structured error pointing to the replacement", () => {
      const r = buildRemovedResponse("davinci", {
        stage: "removed",
        replacement: "graph_materialize",
        sinceVersion: "v11",
      });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/davinci/);
      expect(r.error).toMatch(/graph_materialize/);
      // Rollback hint lives in its own field for clarity.
      expect(r.rollback).toMatch(/MCP_GRAPH_LEGACY_TOOLS/);
    });
  });

  describe("attachDeprecationNotice", () => {
    it("wraps a successful response with _deprecation_notice for warning stage", () => {
      const original = { ok: true, value: 42 };
      const wrapped = attachDeprecationNotice(original, "siebel", {
        stage: "warning",
        replacement: "graph_validate_ui",
        sinceVersion: "v11",
      });
      expect(wrapped.ok).toBe(true);
      expect(wrapped.value).toBe(42);
      expect(wrapped._deprecation_notice).toBeTruthy();
      expect(typeof wrapped._deprecation_notice).toBe("string");
      expect(wrapped._deprecation_notice as string).toMatch(/siebel/);
      expect(wrapped._deprecation_notice as string).toMatch(/graph_validate_ui/);
    });

    it("does NOT add _deprecation_notice for advisory stage (silent log only)", () => {
      const original = { ok: true, value: 1 };
      const wrapped = attachDeprecationNotice(original, "davinci", {
        stage: "advisory",
        replacement: "graph_materialize",
        sinceVersion: "v11",
      });
      expect(wrapped.ok).toBe(true);
      expect(wrapped.value).toBe(1);
      expect(wrapped._deprecation_notice).toBeUndefined();
    });
  });
});
