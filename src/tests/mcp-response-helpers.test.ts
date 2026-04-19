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
import { mcpText, mcpError } from "../mcp/response-helpers.js";

describe("mcpText", () => {
  it("should format data as JSON text response", () => {
    const result = mcpText({ ok: true, count: 5 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ ok: true, count: 5 });
  });

  it("should use compact JSON (no pretty-printing) to save tokens", () => {
    const result = mcpText({ a: 1 });
    expect(result.content[0].text).toBe(JSON.stringify({ a: 1 }));
  });

  it("should not have isError flag", () => {
    const result = mcpText({ ok: true });
    expect(result).not.toHaveProperty("isError");
  });
});

describe("mcpError", () => {
  it("should format Error instance as error response", () => {
    const result = mcpError(new Error("something went wrong"));
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("something went wrong");
  });

  it("should format string as error response", () => {
    const result = mcpError("raw error");
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("raw error");
  });

  it("should always set isError to true", () => {
    expect(mcpError("test").isError).toBe(true);
    expect(mcpError(new Error("test")).isError).toBe(true);
  });
});
