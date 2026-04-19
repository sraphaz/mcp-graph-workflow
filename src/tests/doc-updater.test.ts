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
import { applySectionWithName } from "../core/docs/doc-updater.js";

describe("doc-updater", () => {
  it("should replace content between named markers", () => {
    const existing = `# Title

<!-- mcp-graph:stats:start -->
old content
<!-- mcp-graph:stats:end -->

footer`;

    const result = applySectionWithName(existing, "stats", "new content");

    expect(result).toContain("new content");
    expect(result).not.toContain("old content");
    expect(result).toContain("# Title");
    expect(result).toContain("footer");
  });

  it("should return unchanged content if markers dont exist", () => {
    const existing = "# Title\n\nsome content\n";

    const result = applySectionWithName(existing, "stats", "new content");

    expect(result).toBe(existing);
  });

  it("should support multiple marker pairs in same file", () => {
    const existing = `# Doc

<!-- mcp-graph:tools:start -->
old tools
<!-- mcp-graph:tools:end -->

middle text

<!-- mcp-graph:routes:start -->
old routes
<!-- mcp-graph:routes:end -->

footer`;

    let result = applySectionWithName(existing, "tools", "new tools");
    result = applySectionWithName(result, "routes", "new routes");

    expect(result).toContain("new tools");
    expect(result).toContain("new routes");
    expect(result).not.toContain("old tools");
    expect(result).not.toContain("old routes");
    expect(result).toContain("middle text");
    expect(result).toContain("footer");
  });

  it("should preserve content outside markers", () => {
    const existing = `before
<!-- mcp-graph:test:start -->
old
<!-- mcp-graph:test:end -->
after`;

    const result = applySectionWithName(existing, "test", "replaced");

    expect(result).toContain("before");
    expect(result).toContain("after");
    expect(result).toContain("replaced");
  });

  it("should be idempotent", () => {
    const existing = `<!-- mcp-graph:x:start -->
content
<!-- mcp-graph:x:end -->`;

    const r1 = applySectionWithName(existing, "x", "new");
    const r2 = applySectionWithName(r1, "x", "new");

    expect(r1).toBe(r2);
  });
});
