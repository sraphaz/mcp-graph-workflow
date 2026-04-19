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

import { describe, it, expect, vi } from "vitest";

// Mock pdf-parse before importing the module
vi.mock("pdf-parse", () => ({
  default: vi.fn(async (buffer: Buffer) => {
    const text = buffer.toString("utf-8");
    if (text.includes("CORRUPT_PDF")) {
      throw new Error("Invalid PDF structure");
    }
    return {
      text: `parsed: ${text}`,
      numpages: 1,
      info: {},
    };
  }),
}));

import { readPdfBuffer } from "../core/parser/read-pdf.js";

describe("readPdfBuffer", () => {
  it("should return text and page count from a valid buffer", async () => {
    const buffer = Buffer.from("Hello PDF content");

    const result = await readPdfBuffer(buffer);

    expect(result.text).toBe("parsed: Hello PDF content");
    expect(result.pages).toBe(1);
  });

  it("should pass buffer to pdf-parse", async () => {
    const pdfParse = (await import("pdf-parse")).default as ReturnType<typeof vi.fn>;
    pdfParse.mockClear();

    const buffer = Buffer.from("test content");
    await readPdfBuffer(buffer);

    expect(pdfParse).toHaveBeenCalledWith(buffer);
  });

  it("should propagate errors from pdf-parse", async () => {
    const buffer = Buffer.from("CORRUPT_PDF");

    await expect(readPdfBuffer(buffer)).rejects.toThrow("Invalid PDF structure");
  });

  it("should handle empty buffer", async () => {
    const buffer = Buffer.from("");

    const result = await readPdfBuffer(buffer);

    expect(result.text).toBe("parsed: ");
    expect(result.pages).toBe(1);
  });
});
