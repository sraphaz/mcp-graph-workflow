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
import { readHtmlContent } from "../core/parser/read-html.js";

describe("readHtmlContent", () => {
  it("should extract text from HTML, stripping tags", async () => {
    const html = "<html><body><h1>Title</h1><p>Hello world</p></body></html>";
    const text = await readHtmlContent(html);

    expect(text).toContain("Title");
    expect(text).toContain("Hello world");
    expect(text).not.toContain("<h1>");
    expect(text).not.toContain("<p>");
  });

  it("should remove script and style elements", async () => {
    const html = `
      <html><body>
        <script>alert("xss")</script>
        <style>.red { color: red }</style>
        <p>Visible content</p>
      </body></html>
    `;
    const text = await readHtmlContent(html);

    expect(text).toContain("Visible content");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color: red");
  });

  it("should remove nav, footer, and header elements", async () => {
    const html = `
      <html><body>
        <nav>Menu items</nav>
        <main><p>Main content</p></main>
        <footer>Footer stuff</footer>
      </body></html>
    `;
    const text = await readHtmlContent(html);

    expect(text).toContain("Main content");
    expect(text).not.toContain("Menu items");
    expect(text).not.toContain("Footer stuff");
  });

  it("should preserve line breaks between block elements", async () => {
    const html = "<html><body><h1>Title</h1><p>Para 1</p><p>Para 2</p></body></html>";
    const text = await readHtmlContent(html);

    expect(text).toContain("Title");
    expect(text).toContain("Para 1");
    expect(text).toContain("Para 2");
  });
});
