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
import { getErrorMessage } from "../core/utils/errors.js";

describe("getErrorMessage", () => {
  it("should extract message from Error instance", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("should convert string to string", () => {
    expect(getErrorMessage("raw string")).toBe("raw string");
  });

  it("should convert number to string", () => {
    expect(getErrorMessage(42)).toBe("42");
  });

  it("should convert null to string", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("should convert undefined to string", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("should handle custom Error subclasses", () => {
    class CustomError extends Error {
      constructor() {
        super("custom");
        this.name = "CustomError";
      }
    }
    expect(getErrorMessage(new CustomError())).toBe("custom");
  });
});
