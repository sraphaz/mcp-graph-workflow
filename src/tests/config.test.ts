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
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { loadConfig } from "../core/config/config-loader.js";
import { ConfigSchema } from "../core/config/config-schema.js";

describe("Config layer", () => {
  let tmpDir: string;
  const originalMcpPort = process.env.MCP_PORT;
  const originalCodeGraphAutoIndex = process.env.CODE_GRAPH_AUTO_INDEX;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `config-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    delete process.env.MCP_PORT;
    delete process.env.CODE_GRAPH_AUTO_INDEX;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalMcpPort !== undefined) {
      process.env.MCP_PORT = originalMcpPort;
    } else {
      delete process.env.MCP_PORT;
    }
    if (originalCodeGraphAutoIndex !== undefined) {
      process.env.CODE_GRAPH_AUTO_INDEX = originalCodeGraphAutoIndex;
    } else {
      delete process.env.CODE_GRAPH_AUTO_INDEX;
    }
  });

  // ── Defaults ──────────────────────────────────────

  it("should load default config when no file exists", () => {
    const config = loadConfig(tmpDir);

    expect(config.port).toBe(3000);
    expect(config.dbPath).toBe("workflow-graph");
    expect(config.integrations.codeGraphAutoIndex).toBe(true);
    expect(config.integrations.codeGraphReindexIntervalSec).toBe(0);
  });

  it("should accept codeGraphReindexIntervalSec config", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({ integrations: { codeGraphReindexIntervalSec: 120 } }),
    );
    const config = loadConfig(tmpDir);
    expect(config.integrations.codeGraphReindexIntervalSec).toBe(120);
  });

  // ── File loading ──────────────────────────────────

  it("should load and validate config file", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({ port: 4000, dbPath: "custom-db" }),
    );

    const config = loadConfig(tmpDir);

    expect(config.port).toBe(4000);
    expect(config.dbPath).toBe("custom-db");
  });

  it("should reject invalid config via Zod schema", () => {
    expect(() => ConfigSchema.parse({ port: "not-a-number" })).toThrow();
  });

  it("should reject port out of range", () => {
    expect(() => ConfigSchema.parse({ port: 0 })).toThrow();
    expect(() => ConfigSchema.parse({ port: 99999 })).toThrow();
  });

  // ── Env var overrides ─────────────────────────────

  it("should override port from MCP_PORT env var", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({ port: 4000 }),
    );

    process.env.MCP_PORT = "5555";
    const config = loadConfig(tmpDir);

    expect(config.port).toBe(5555);
  });

  it("should override codeGraphAutoIndex from CODE_GRAPH_AUTO_INDEX env var", () => {
    process.env.CODE_GRAPH_AUTO_INDEX = "true";
    const config = loadConfig(tmpDir);

    expect(config.integrations.codeGraphAutoIndex).toBe(true);
  });

  // ── Missing optional fields ───────────────────────

  it("should use defaults for missing optional fields", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({}),
    );

    const config = loadConfig(tmpDir);

    expect(config.port).toBe(3000);
    expect(config.dbPath).toBe("workflow-graph");
    expect(config.basePath).toBeUndefined();
    expect(config.integrations.codeGraphAutoIndex).toBe(true);
  });

  // ── contextMode ───────────────────────────────────

  it("should default contextMode to lean", () => {
    const config = loadConfig(tmpDir);

    expect(config.contextMode).toBe("lean");
  });

  it("should accept contextMode lean from config file", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({ contextMode: "lean" }),
    );

    const config = loadConfig(tmpDir);

    expect(config.contextMode).toBe("lean");
  });

  it("should accept contextMode full from config file", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({ contextMode: "full" }),
    );

    const config = loadConfig(tmpDir);

    expect(config.contextMode).toBe("full");
  });

  it("should reject invalid contextMode via Zod schema", () => {
    expect(() => ConfigSchema.parse({ contextMode: "invalid" })).toThrow();
  });

  it("should refuse to boot with malformed JSON config (B23)", () => {
    // Updated 2026-05-03: previous behaviour (silently fall back to defaults)
    // was filed as B23 — users were running with a config that wasn't actually
    // applied. loadConfig now throws on JSON parse failure.
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      "{ invalid json",
    );

    expect(() => loadConfig(tmpDir)).toThrow(/invalid config/i);
  });
});
