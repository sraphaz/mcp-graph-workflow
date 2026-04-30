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

// Mock pdf-parse v2 (PDFParse class) before importing the module
const lastCallArgs: { data?: Uint8Array }[] = [];
class FakePDFParse {
  constructor(opts: { data: Uint8Array }) {
    lastCallArgs.push(opts);
    this.data = opts.data;
  }
  private data: Uint8Array;
  async getText(): Promise<{ text: string; total: number }> {
    const text = new TextDecoder().decode(this.data);
    if (text.includes("CORRUPT_PDF")) {
      throw new Error("Invalid PDF structure");
    }
    return { text: `parsed: ${text}`, total: 1 };
  }
}
vi.mock("pdf-parse", () => ({ PDFParse: FakePDFParse }));

import { readPdfBuffer } from "../core/parser/read-pdf.js";

describe("readPdfBuffer", () => {
  it("should return text and page count from a valid buffer", async () => {
    const buffer = Buffer.from("Hello PDF content");

    const result = await readPdfBuffer(buffer);

    expect(result.text).toBe("parsed: Hello PDF content");
    expect(result.pages).toBe(1);
  });

  it("should pass buffer to PDFParse constructor", async () => {
    lastCallArgs.length = 0;
    const buffer = Buffer.from("test content");
    await readPdfBuffer(buffer);

    expect(lastCallArgs).toHaveLength(1);
    const passed = lastCallArgs[0]!.data!;
    expect(new TextDecoder().decode(passed)).toBe("test content");
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
