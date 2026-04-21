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
import {
  scaffoldContract,
  type ContractSpec,
} from "../../core/scaffolder/contract-scaffolder.js";

// ── Fixtures ──────────────────────────────────────────────────────────────

const fullContract: ContractSpec = {
  id: "ct_create_node",
  name: "CreateNode",
  description: "Creates a new node in the graph",
  inputSchemaRef: "CreateNodeInputSchema",
  outputSchemaRef: "CreateNodeOutputSchema",
  handlerType: "rest",
};

const noOutputContract: ContractSpec = {
  id: "ct_delete_node",
  name: "DeleteNode",
  description: "Deletes a node from the graph",
  inputSchemaRef: "DeleteNodeInputSchema",
  outputSchemaRef: null,
  handlerType: "rest",
};

const mcpContract: ContractSpec = {
  id: "ct_mcp_tool",
  name: "McpGetNode",
  description: "MCP tool handler",
  inputSchemaRef: "GetNodeInputSchema",
  outputSchemaRef: "GetNodeOutputSchema",
  handlerType: "mcp",
};

// ── AC 1: imports schemas from src/schemas/ and calls .parse() on both ────

describe("scaffoldContract (AC 1 — schema import + parse)", () => {
  it("should import the input schema from src/schemas/", () => {
    const result = scaffoldContract(fullContract);

    expect(result.handlerFile.content).toContain("src/schemas/");
    expect(result.handlerFile.content).toContain("CreateNodeInputSchema");
  });

  it("should import the output schema from src/schemas/", () => {
    const result = scaffoldContract(fullContract);

    expect(result.handlerFile.content).toContain("CreateNodeOutputSchema");
  });

  it("should call .parse() on both input and output schemas", () => {
    const result = scaffoldContract(fullContract);
    const parseCount = (result.handlerFile.content.match(/\.parse\(/g) ?? []).length;

    expect(parseCount).toBeGreaterThanOrEqual(2);
  });

  it("should generate a function with the contract name", () => {
    const result = scaffoldContract(fullContract);

    expect(result.handlerFile.content).toContain("CreateNode");
  });

  it("should place the handler in the correct path", () => {
    const result = scaffoldContract(fullContract);

    expect(result.handlerFile.path).toContain("create-node");
  });
});

// ── AC 2: invalid input → 400 / typed error without executing core ─────────

describe("scaffoldContract (AC 2 — validation guard)", () => {
  it("should include a try/catch around input parsing", () => {
    const result = scaffoldContract(fullContract);

    expect(result.handlerFile.content).toContain("try");
    expect(result.handlerFile.content).toContain("catch");
  });

  it("should include 400 status code or ValidationError in the error path for REST handlers", () => {
    const result = scaffoldContract(fullContract);

    const hasStatus400 = result.handlerFile.content.includes("400");
    const hasValidationError = result.handlerFile.content.includes("ValidationError");
    expect(hasStatus400 || hasValidationError).toBe(true);
  });

  it("should reference the error before calling the core handler", () => {
    const result = scaffoldContract(fullContract);
    const content = result.handlerFile.content;

    const parseIndex = content.indexOf(".parse(");
    const coreIndex = content.indexOf("// CORE:");
    expect(parseIndex).toBeLessThan(coreIndex);
  });

  it("should work for MCP-type handlers", () => {
    const result = scaffoldContract(mcpContract);

    expect(result.handlerFile.content).toContain(".parse(");
    expect(result.handlerFile.content).toContain("GetNodeInputSchema");
  });
});

// ── AC 3: missing output schema → z.unknown() with TODO ───────────────────

describe("scaffoldContract (AC 3 — missing output fallback)", () => {
  it("should use z.unknown() when outputSchemaRef is null", () => {
    const result = scaffoldContract(noOutputContract);

    expect(result.handlerFile.content).toContain("z.unknown()");
  });

  it("should include a TODO comment when outputSchemaRef is null", () => {
    const result = scaffoldContract(noOutputContract);

    expect(result.handlerFile.content).toContain("TODO");
  });

  it("should report a warning in the result when no output schema", () => {
    const result = scaffoldContract(noOutputContract);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("output");
  });

  it("should not warn when output schema is provided", () => {
    const result = scaffoldContract(fullContract);

    expect(result.warnings).toHaveLength(0);
  });
});

// ── Structural ─────────────────────────────────────────────────────────────

describe("scaffoldContract structural", () => {
  it("should return handlerFile with path and content", () => {
    const result = scaffoldContract(fullContract);

    expect(result.handlerFile.path).toBeTruthy();
    expect(result.handlerFile.content).toBeTruthy();
  });

  it("should return warnings as an array", () => {
    const result = scaffoldContract(fullContract);

    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
