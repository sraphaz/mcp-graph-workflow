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
import { readDocxContent, isDocxSupported } from "../../core/parser/read-docx.js";

describe("read-docx", () => {
  describe("isDocxSupported", () => {
    it("should return true for .docx extension", () => {
      expect(isDocxSupported(".docx")).toBe(true);
    });

    it("should return true for .doc extension", () => {
      expect(isDocxSupported(".doc")).toBe(true);
    });

    it("should return false for .pdf extension", () => {
      expect(isDocxSupported(".pdf")).toBe(false);
    });

    it("should return false for .txt extension", () => {
      expect(isDocxSupported(".txt")).toBe(false);
    });
  });

  describe("readDocxContent", () => {
    it("should throw FileNotFoundError for non-existent file", async () => {
      await expect(readDocxContent("/nonexistent/file.docx")).rejects.toThrow();
    });

    // Integration test with real .docx would require a fixture file.
    // We test the module's error handling and edge cases.
    it("should throw on empty buffer", async () => {
      // mammoth will throw on invalid/empty buffer
      await expect(readDocxContent("/dev/null")).rejects.toThrow();
    });
  });
});
