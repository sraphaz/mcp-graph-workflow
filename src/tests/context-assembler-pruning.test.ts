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

import { describe, it, expect } from "vitest";
import { pruneContextSection } from "../core/context/context-pruning.js";

describe("Context Assembler Pruning Integration (Parnas Information Hiding)", () => {
  const typescriptCode = `import { z } from 'zod/v4';

export interface Config {
  port: number;
  host: string;
}

export function startServer(config: Config): void {
  const http = require('http');
  const server = http.createServer();
  server.listen(config.port, config.host);
  console.log('Server started');
  console.log('Port:', config.port);
  console.log('Host:', config.host);
}

export function stopServer(): void {
  const process = require('process');
  process.exit(0);
  console.log('exiting');
  console.log('cleanup');
}

function internalHelper(): string {
  const x = 1;
  const y = 2;
  const z = 3;
  return String(x + y + z);
}
`;

  it("should prune code sections and return summary with reduction stats", () => {
    const result = pruneContextSection(typescriptCode, ["startServer"]);

    // Exported functions preserved (preserveExports=true by default)
    expect(result.prunedContent).toContain("export function startServer");
    expect(result.prunedContent).toContain("server.listen"); // preserved body

    // Internal (non-exported) helper should be pruned
    expect(result.prunedContent).not.toContain("const x = 1"); // internalHelper pruned

    expect(result.summary.reductionPercent).toBeGreaterThan(0);
    expect(result.summary.originalTokens).toBeGreaterThan(0);
    expect(result.summary.prunedTokens).toBeLessThan(result.summary.originalTokens);
  });

  it("should return original content when pruning=false (backward compat)", () => {
    const result = pruneContextSection(typescriptCode, ["startServer"], false);

    expect(result.prunedContent).toBe(typescriptCode);
    expect(result.summary.reductionPercent).toBe(0);
  });

  it("should return original content for non-TypeScript text", () => {
    const markdown = "# Hello\n\nThis is just text, not code.";
    const result = pruneContextSection(markdown, ["anything"]);

    expect(result.prunedContent).toBe(markdown);
    expect(result.summary.reductionPercent).toBe(0);
  });

  it("should preserve exports with no relevant symbols specified", () => {
    const result = pruneContextSection(typescriptCode, []);

    // With no relevant symbols but preserveExports=true (default), exported bodies stay
    expect(result.prunedContent).toContain("server.listen");
    expect(result.prunedContent).toContain("process.exit");

    // Internal helper should be pruned
    expect(result.prunedContent).not.toContain("const x = 1");
  });

  it("should return summary with all required fields", () => {
    const result = pruneContextSection(typescriptCode, ["startServer"]);

    expect(result.summary).toHaveProperty("originalTokens");
    expect(result.summary).toHaveProperty("prunedTokens");
    expect(result.summary).toHaveProperty("reductionPercent");
    expect(result.summary).toHaveProperty("symbolsPreserved");
    expect(result.summary).toHaveProperty("symbolsTruncated");
  });
});
